import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  signal
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  IonApp,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonInput,
    IonRange,
    IonIcon,
    IonButtons,
    IonButton,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { optionsOutline } from 'ionicons/icons';
import { BikeType, bikePresets, getBikePreset } from './bike-presets';
import {
  POWER_DISTRIBUTIONS,
  PowerDistribution,
  getDistributionIdForWatts,
  mapRiderType
} from './utils/power';

interface TrackPoint {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
}

interface TrackProfile {
  totalDistanceKm: number;
  minElevation: number;
  maxElevation: number;
  graphWidth: number;
  graphHeight: number;
  paddingTop: number;
  linePath: string;
  fillPath: string;
  distanceTicks: AxisTick[];
  elevationTicks: AxisTick[];
}

interface AxisTick {
  value: number;
  position: number;
}

interface TimeTick {
  timeSeconds: number;
  label: string;
  position: number;
  percent: number;
}

interface TimelinePoint {
  cumulativeTimeSeconds: number;
  cumulativeDistanceMeters: number;
}

interface ParsedGpx {
  points: TrackPoint[];
  name: string | null;
}
interface BikeFormModel {
  bikeType: BikeType;
  bikeWeightKg: number;
  riderWeightKg: number;
  avgWatts: number;
  crr: number;
  cda: number;
  efficiency: number;
}

interface RideEstimate {
  totalTimeSeconds: number;
  formatted: string;
  averageSpeedKph: number;
  totalDistanceMeters: number;
  timeline: TimelinePoint[];
}

const GRAPH_HEIGHT = 400;
const GRAPH_WIDTH = 1000;
const GRAPH_PADDING_TOP = 28;
const DISTANCE_STEP_KM = 10;
const ELEVATION_STEP_M = 100;
const GRAVITY = 9.80665;
const AIR_DENSITY = 1.225;
const MIN_SPEED_MPS = 0.5;
const BIKE_FORM_STORAGE_KEY = 'velogiro-bike-form';
const TIME_TICK_INTERVAL_SECONDS = 30 * 60;
const MIN_GRAPH_WIDTH = 320;
const DEFAULT_GPX_ASSET = 'assets/example-gpx-track.gpx';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    IonApp,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonRange,
    IonIcon,
    IonButtons,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  protected readonly title = signal('velogiro-trackassistant');
  protected readonly trackPoints = signal<TrackPoint[]>([]);
  protected readonly parseError = signal<string | null>(null);
  protected readonly bikeTypeOptions = Object.entries(bikePresets).map(([key, preset]) => ({
    value: key as BikeType,
    label: preset.label
  }));
  protected readonly bikeForm = signal<BikeFormModel>(createDefaultBikeForm());
  protected readonly graphWidth = signal(GRAPH_WIDTH);
  protected readonly riderTypeLabel = computed(() => mapRiderType(this.bikeForm().avgWatts));
  protected readonly gpxFileName = signal<string | null>(null);
  protected readonly showCoefficientRow = signal(false);
  protected readonly powerDistributions = POWER_DISTRIBUTIONS;
  protected readonly selectedPowerDistribution = signal<'custom' | PowerDistribution['id']>('custom');

  @ViewChild('graphHost')
  private set graphHost(element: ElementRef<HTMLElement> | undefined) {
    this.teardownResizeObserver();
    this.graphHostElement = element;
    if (element) {
      this.initializeResizeObserver(element);
    }
  }

  private graphHostElement?: ElementRef<HTMLElement>;
  private resizeObserver?: ResizeObserver;

  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly ngZone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    addIcons({ 'options-outline': optionsOutline });
    const stored = this.loadBikeFormFromStorage();
    if (stored) {
      this.bikeForm.set(stored);
      this.selectedPowerDistribution.set(getDistributionIdForWatts(stored.avgWatts));
    } else {
      const initialWatts = this.bikeForm().avgWatts;
      this.persistBikeForm(this.bikeForm());
      this.selectedPowerDistribution.set(getDistributionIdForWatts(initialWatts));
    }
  }

  public async ngOnInit(): Promise<void> {
    if (this.isBrowser && this.trackPoints().length === 0) {
      await this.loadDefaultGpxTrack();
    }
  }

  public ngAfterViewInit(): void {
    if (this.graphHostElement) {
      this.updateGraphWidth(this.graphHostElement);
    }
  }

  public ngOnDestroy(): void {
    this.teardownResizeObserver();
  }

  protected readonly trackProfile = computed<TrackProfile | null>(() => {
    const width = Math.max(this.graphWidth(), MIN_GRAPH_WIDTH);
    const points = this.trackPoints();
    if (!points.length) {
      return null;
    }

    const totalDistanceKm = points[points.length - 1].distanceKm;
    const elevations = points.map((point) => point.elevation);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationRange = Math.max(maxElevation - minElevation, 1);
    const usableHeight = GRAPH_HEIGHT - GRAPH_PADDING_TOP;

    const coords = points.map((point) => {
      const x = totalDistanceKm ? (point.distanceKm / totalDistanceKm) * width : 0;
      const normalized = (point.elevation - minElevation) / elevationRange;
      const y = GRAPH_PADDING_TOP + (1 - normalized) * usableHeight;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });

    const linePath = coords.length
      ? `M ${coords[0]}${coords.length > 1 ? ' L ' + coords.slice(1).join(' L ') : ''}`
      : '';
    const fillPath = coords.length
      ? `M 0 ${GRAPH_HEIGHT} L ${coords.join(' L ')} L ${width} ${GRAPH_HEIGHT} Z`
      : '';
    const distanceTicks = this.createAxisTicks(totalDistanceKm, DISTANCE_STEP_KM).map((value) => ({
      value,
      position: totalDistanceKm ? (value / totalDistanceKm) * width : 0
    }));
    const elevationTicks = this.createAxisTicks(elevationRange, ELEVATION_STEP_M).map((offset) => {
      const value = minElevation + offset;
      const normalized = (value - minElevation) / elevationRange;
      const position = GRAPH_PADDING_TOP + (1 - normalized) * usableHeight;
      return { value, position };
    });

    return {
      totalDistanceKm,
      minElevation,
      maxElevation,
      graphWidth: width,
      graphHeight: GRAPH_HEIGHT,
      paddingTop: GRAPH_PADDING_TOP,
      linePath,
      fillPath,
      distanceTicks,
      elevationTicks
    };
  });

  protected readonly hasTrack = computed(() => this.trackPoints().length > 0);
  protected readonly totalSystemWeightKg = computed(
    () => this.bikeForm().bikeWeightKg + this.bikeForm().riderWeightKg
  );
  protected readonly rideEstimate = computed<RideEstimate | null>(() => {
    const points = this.trackPoints();
    if (points.length < 2) {
      return null;
    }

    const { bikeWeightKg, riderWeightKg, avgWatts, crr, cda, efficiency } = this.bikeForm();
    if (
      avgWatts <= 0 ||
      bikeWeightKg <= 0 ||
      riderWeightKg <= 0 ||
      crr <= 0 ||
      cda <= 0 ||
      efficiency <= 0
    ) {
      return null;
    }

    const totalMassKg = bikeWeightKg + riderWeightKg;
    const drivetrainEfficiency = this.clamp(efficiency, 0.5, 0.99);
    const wheelPower = avgWatts * drivetrainEfficiency;
    if (wheelPower <= 0 || totalMassKg <= 0) {
      return null;
    }

    let totalTimeSeconds = 0;
    let totalDistanceMeters = 0;
    const timeline: TimelinePoint[] = [
      { cumulativeTimeSeconds: 0, cumulativeDistanceMeters: 0 }
    ];

    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const current = points[i];
      const deltaDistanceMeters = (current.distanceKm - previous.distanceKm) * 1000;
      if (deltaDistanceMeters <= 0) {
        continue;
      }

      const deltaElevation = current.elevation - previous.elevation;
      const grade = deltaDistanceMeters !== 0 ? deltaElevation / deltaDistanceMeters : 0;
      const fg = totalMassKg * GRAVITY * grade;
      const fr = totalMassKg * GRAVITY * Math.max(crr, 0.0001);
      const speed = this.solveSpeedForPower(wheelPower, fg, fr, Math.max(cda, 0.05));

      totalTimeSeconds += deltaDistanceMeters / speed;
      totalDistanceMeters += deltaDistanceMeters;
      timeline.push({
        cumulativeTimeSeconds: totalTimeSeconds,
        cumulativeDistanceMeters: totalDistanceMeters
      });
    }

    if (!Number.isFinite(totalTimeSeconds) || totalTimeSeconds <= 0) {
      return null;
    }

    const distanceKm = totalDistanceMeters / 1000;
    const averageSpeedKph = distanceKm / (totalTimeSeconds / 3600);

    return {
      totalTimeSeconds,
      formatted: this.formatDuration(totalTimeSeconds),
      averageSpeedKph,
      totalDistanceMeters,
      timeline
    };
  });

  protected readonly timeTicks = computed<TimeTick[]>(() => {
    const profile = this.trackProfile();
    const estimate = this.rideEstimate();
    if (!profile || !estimate) {
      return [];
    }

    const totalTimeSeconds = estimate.totalTimeSeconds;
    const totalDistanceMeters = estimate.totalDistanceMeters;
    const timeline = estimate.timeline;
    if (!Number.isFinite(totalTimeSeconds) || totalTimeSeconds <= 0) {
      return [];
    }

    const ticks: TimeTick[] = [];
    const intervals = Math.floor(totalTimeSeconds / TIME_TICK_INTERVAL_SECONDS);

    for (let i = 1; i <= intervals; i += 1) {
      const seconds = i * TIME_TICK_INTERVAL_SECONDS;
      const distanceMeters = this.distanceAtTime(timeline, seconds);
      const ratio = totalDistanceMeters
        ? Math.min(distanceMeters / totalDistanceMeters, 1)
        : Math.min(seconds / totalTimeSeconds, 1);
      ticks.push({
        timeSeconds: seconds,
        label: this.formatAxisTimeLabel(seconds),
        position: ratio * profile.graphWidth,
        percent: ratio * 100
      });
    }

    if (!ticks.length || ticks[ticks.length - 1].timeSeconds < totalTimeSeconds) {
      const distanceMeters = this.distanceAtTime(timeline, totalTimeSeconds);
      const ratio = totalDistanceMeters ? distanceMeters / totalDistanceMeters : 1;
      ticks.push({
        timeSeconds: totalTimeSeconds,
        label: this.formatAxisTimeLabel(totalTimeSeconds),
        position: ratio * profile.graphWidth,
        percent: ratio * 100
      });
    }

    return ticks;
  });

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      this.applyParsedTrack(text, file.name ?? undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse GPX file.';
      this.parseError.set(message);
      this.trackPoints.set([]);
      this.selectedPowerDistribution.set('custom');
      this.gpxFileName.set(null);
    } finally {
      input.value = '';
    }
  }

  protected updateBikeForm<K extends keyof BikeFormModel>(field: K, value: BikeFormModel[K]): void {
    this.bikeForm.update((current) => {
      const next = {
        ...current,
        [field]: value
      };
      this.persistBikeForm(next);
      return next;
    });
  }

  protected onNumericInput<K extends keyof Omit<BikeFormModel, 'bikeType'>>(
    field: K,
    event: CustomEvent
  ): void {
    const rawValue = (event.detail as { value?: string | null })?.value ?? '';
    const parsed = parseFloat(rawValue);
    this.updateBikeForm(field, (Number.isNaN(parsed) ? 0 : parsed) as BikeFormModel[K]);
    if (field === 'avgWatts') {
      this.selectedPowerDistribution.set(getDistributionIdForWatts(this.bikeForm().avgWatts));
    }
  }

  protected onBikeTypeChange(type: BikeType): void {
    const preset = getBikePreset(type);
    const current = this.bikeForm();
    const next: BikeFormModel = {
      ...current,
      bikeType: type,
      crr: preset.crr,
      cda: preset.cda,
      efficiency: preset.efficiency
    };
    this.bikeForm.set(next);
    this.persistBikeForm(next);
  }

  protected toggleCoefficientRow(): void {
    this.showCoefficientRow.update((value) => !value);
  }

  protected onPowerDistributionChange(value: PowerDistribution['id'] | 'custom' | null): void {
    if (!value || value === 'custom') {
      this.selectedPowerDistribution.set('custom');
      return;
    }

    const profile = POWER_DISTRIBUTIONS.find((distribution) => distribution.id === value);
    if (!profile) {
      this.selectedPowerDistribution.set('custom');
      return;
    }

    const target =
      profile.max != null ? Math.round((profile.min + profile.max) / 2) : Math.round(profile.min);
    this.selectedPowerDistribution.set(profile.id);
    this.updateBikeForm('avgWatts', target);
  }

  private extractTrackPoints(gpxText: string): ParsedGpx {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxText, 'application/xml');

    if (doc.querySelector('parsererror')) {
      throw new Error('Invalid GPX file.');
    }

    const trackPoints: TrackPoint[] = [];
    const nodes = Array.from(doc.getElementsByTagName('trkpt'));

    if (!nodes.length) {
      return {
        points: trackPoints,
        name: this.extractGpxName(doc)
      };
    }

    let currentDistanceKm = 0;
    let previous: { lat: number; lon: number } | null = null;

    for (const node of nodes) {
      const lat = parseFloat(node.getAttribute('lat') ?? '');
      const lon = parseFloat(node.getAttribute('lon') ?? '');
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        continue;
      }

      const elevationNode = node.getElementsByTagName('ele')[0];
      const elevationValue = elevationNode?.textContent ?? '0';
      const elevation = parseFloat(elevationValue);

      if (previous) {
        currentDistanceKm += this.haversineDistanceMeters(previous.lat, previous.lon, lat, lon) / 1000;
      }

      trackPoints.push({
        lat,
        lon,
        elevation: Number.isNaN(elevation) ? 0 : elevation,
        distanceKm: currentDistanceKm
      });

      previous = { lat, lon };
    }

    return {
      points: trackPoints,
      name: this.extractGpxName(doc)
    };
  }

  private haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private createAxisTicks(range: number, approxStep: number): number[] {
    if (range <= 0) {
      return [];
    }

    const step = this.calculateStep(range, approxStep);
    const ticks: number[] = [];

    for (let value = step; value < range; value += step) {
      ticks.push(Number(value.toFixed(4)));
    }

    return ticks;
  }

  private calculateStep(range: number, approxStep: number): number {
    if (range <= 0) {
      return approxStep;
    }

    const approxCount = Math.max(1, Math.round(range / approxStep));
    const targetTickCount = Math.max(3, approxCount);
    const rawStep = range / targetTickCount;
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / power;
    const niceMultipliers = [1, 2, 5, 10];
    const multiplier = niceMultipliers.find((m) => normalized <= m) ?? 10;

    return multiplier * power;
  }

  private solveSpeedForPower(
    wheelPower: number,
    gravityForce: number,
    rollingForce: number,
    dragArea: number
  ): number {
    const aeroCoeff = 0.5 * AIR_DENSITY * dragArea;
    let low = MIN_SPEED_MPS;
    let high = 60; // ~216 km/h upper bound

    for (let iteration = 0; iteration < 40; iteration += 1) {
      const mid = (low + high) / 2;
      const requiredPower = mid * (gravityForce + rollingForce) + aeroCoeff * Math.pow(mid, 3);

      if (requiredPower > wheelPower) {
        high = mid;
      } else {
        low = mid;
      }
    }

    return Math.max(low, MIN_SPEED_MPS);
  }

  private formatDuration(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return '0m';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (minutes > 0 || hours > 0) {
      parts.push(`${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}m`);
    }

    if (hours === 0 && parts.length < 2 && seconds > 0) {
      parts.push(`${seconds.toString().padStart(minutes > 0 ? 2 : 1, '0')}s`);
    }

    return parts.join(' ').trim();
  }

  private loadBikeFormFromStorage(): BikeFormModel | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(BIKE_FORM_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<BikeFormModel>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const type = (parsed.bikeType as BikeType) ?? 'gravel';
      const base = createDefaultBikeForm(type);

      return {
        ...base,
        bikeWeightKg: this.ensureNumber(parsed.bikeWeightKg, base.bikeWeightKg),
        riderWeightKg: this.ensureNumber(parsed.riderWeightKg, base.riderWeightKg),
        avgWatts: this.ensureNumber(parsed.avgWatts, base.avgWatts),
        crr: this.ensureNumber(parsed.crr, base.crr),
        cda: this.ensureNumber(parsed.cda, base.cda),
        efficiency: this.ensureNumber(parsed.efficiency, base.efficiency)
      };
    } catch {
      return null;
    }
  }

  private persistBikeForm(form: BikeFormModel): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(BIKE_FORM_STORAGE_KEY, JSON.stringify(form));
    } catch {
      // Ignore storage exceptions (e.g., private mode quota exceeded).
    }
  }

  private ensureNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private formatAxisTimeLabel(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0m';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h${minutes.toString().padStart(2, '0')}m`;
    }

    return `${minutes}m`;
  }

  private distanceAtTime(timeline: TimelinePoint[], targetSeconds: number): number {
    if (!timeline.length || targetSeconds <= 0) {
      return 0;
    }

    for (let i = 1; i < timeline.length; i += 1) {
      const previous = timeline[i - 1];
      const current = timeline[i];

      if (targetSeconds <= current.cumulativeTimeSeconds) {
        const timeDelta = current.cumulativeTimeSeconds - previous.cumulativeTimeSeconds;
        if (timeDelta <= 0) {
          return current.cumulativeDistanceMeters;
        }

        const ratio = (targetSeconds - previous.cumulativeTimeSeconds) / timeDelta;
        const distanceDelta = current.cumulativeDistanceMeters - previous.cumulativeDistanceMeters;
        return previous.cumulativeDistanceMeters + ratio * distanceDelta;
      }
    }

    return timeline[timeline.length - 1].cumulativeDistanceMeters;
  }

  private extractGpxName(doc: Document): string | null {
    const metadataName = doc.querySelector('metadata > name')?.textContent?.trim();
    if (metadataName) {
      return metadataName;
    }

    const trackName = doc.querySelector('trk > name')?.textContent?.trim();
    return trackName || null;
  }

  private applyParsedTrack(gpxText: string, fallbackName?: string): void {
    const parsed = this.extractTrackPoints(gpxText);
    const points = parsed.points;

    if (!points.length) {
      throw new Error('The GPX file does not contain any track points.');
    }

    this.trackPoints.set(points);
    this.parseError.set(null);
    this.gpxFileName.set(parsed.name ?? fallbackName ?? null);
    this.selectedPowerDistribution.set(getDistributionIdForWatts(this.bikeForm().avgWatts));
  }

  private async loadDefaultGpxTrack(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    try {
      const baseHref = this.document.querySelector('base')?.getAttribute('href') ?? '/';
      const baseUrl = new URL(baseHref, this.document.location.origin);
      const assetUrl = new URL(DEFAULT_GPX_ASSET, baseUrl).toString();
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error('Failed to load default GPX asset.');
      }

      const text = await response.text();
      this.applyParsedTrack(text, 'Example GPX Track');
    } catch (error) {
      console.warn('Unable to load example GPX track.', error);
    }
  }


  protected clampLabelPosition(position: number, width: number, margin = 12): number {
    if (position < margin) {
      return margin;
    }

    if (position > width - margin) {
      return width - margin;
    }

    return position;
  }

  protected labelAnchor(position: number, width: number, margin = 24): 'start' | 'middle' | 'end' {
    if (position < margin) {
      return 'start';
    }

    if (position > width - margin) {
      return 'end';
    }

    return 'middle';
  }


  private initializeResizeObserver(element: ElementRef<HTMLElement>): void {
    this.updateGraphWidth(element);
    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        const width = Math.max(entry.contentRect.width, MIN_GRAPH_WIDTH);
        this.ngZone.run(() => {
          if (width !== this.graphWidth()) {
            this.graphWidth.set(width);
          }
        });
      });
      this.resizeObserver.observe(element.nativeElement);
    });
  }

  private updateGraphWidth(element: ElementRef<HTMLElement>): void {
    const width = Math.max(element.nativeElement.getBoundingClientRect().width, MIN_GRAPH_WIDTH);
    if (width && width !== this.graphWidth()) {
      this.graphWidth.set(width);
    }
  }

  private teardownResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }
}

function createDefaultBikeForm(type: BikeType = 'gravel'): BikeFormModel {
  const preset = getBikePreset(type);
  return {
    bikeType: type,
    bikeWeightKg: 8,
    riderWeightKg: 70,
    avgWatts: 200,
    crr: preset.crr,
    cda: preset.cda,
    efficiency: preset.efficiency
  };
}
