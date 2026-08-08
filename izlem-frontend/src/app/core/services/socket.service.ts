import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import {
  Incident,
  IncidentStatus,
  NewIncidentEvent,
  IncidentReceivedEvent,
  IncidentAlarmEvent,
  IncidentResolvedEvent,
  RuleTriggeredEvent,
  FlagResolvedEvent
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  
  private socket: Socket | null = null;
  private readonly wsUrl = environment.wsUrl;
  private readonly apiUrl = environment.apiUrl;

  // Signals for live incident state
  private _liveIncidents = signal<Incident[]>([]);
  private _connected = signal<boolean>(false);
  private _isOnline = signal<boolean>(navigator.onLine);
  private _lastAlarm = signal<IncidentAlarmEvent | null>(null);
  private _connectionError = signal<string | null>(null);
  private _lastRuleTriggered = signal<RuleTriggeredEvent | null>(null);
  private _lastFlagResolved = signal<FlagResolvedEvent | null>(null);

  // Public readonly signals
  readonly liveIncidents = this._liveIncidents.asReadonly();
  readonly connected = this._connected.asReadonly();
  readonly isOnline = this._isOnline.asReadonly();
  readonly lastAlarm = this._lastAlarm.asReadonly();
  readonly connectionError = this._connectionError.asReadonly();
  readonly lastRuleTriggered = this._lastRuleTriggered.asReadonly();
  readonly lastFlagResolved = this._lastFlagResolved.asReadonly();

  constructor() {
    window.addEventListener('online', () => this._isOnline.set(true));
    window.addEventListener('offline', () => this._isOnline.set(false));

    // Auto-disconnect when user logs out
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.disconnect();
      }
    });
  }

  // Computed stats (only count today's non-resolved/received)
  readonly totalInTransit = computed(() =>
    this._liveIncidents().filter(i => i.status === IncidentStatus.DISPATCHED).length
  );

  readonly overdueCount = computed(() =>
    this._liveIncidents().filter(i => {
      if (i.status !== IncidentStatus.DISPATCHED) return false;
      const minutes = this.getMinutesSince(new Date(i.dispatchedAt));
      return minutes > 10;
    }).length
  );

  readonly criticalCount = computed(() =>
    this._liveIncidents().filter(i => i.status === IncidentStatus.UNACCOUNTED).length
  );

  readonly resolvedCount = computed(() =>
    this._liveIncidents().filter(i => i.status === IncidentStatus.RESOLVED).length
  );

  // Computed: only active (dispatched) incidents
  readonly activeIncidents = computed(() =>
    this._liveIncidents().filter(i => i.status === IncidentStatus.DISPATCHED)
  );

  connect(): void {
    if (this.socket?.connected) return;

    // Use dynamic token from AuthService
    const token = this.authService.getToken();
    
    if (!token) {
      console.warn('Cannot connect to WebSocket: No auth token');
      this._connectionError.set('No auth token available');
      return;
    }

    console.log('🔌 Connecting to WebSocket at', this.wsUrl);
    console.log('🔑 Using token:', token.substring(0, 50) + '...');
    
    this.socket = io(this.wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this._connected.set(true);
      this._connectionError.set(null);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this._connected.set(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this._connectionError.set('Connection failed');
    });

    this.socket.on('connected', (data: any) => {
      console.log('🏫 Joined room:', data);
    });

    this.socket.on('new_incident', (event: NewIncidentEvent & { incident?: Incident }) => {
      console.log('🆕 New incident:', event);
      
      // Direct injection: if full incident object is provided, inject it immediately
      if (event.incident) {
        // Only inject if it's from today
        if (this.isToday(event.incident.dispatchedAt)) {
          console.log('📥 Direct injection of incident:', event.incident.id);
          this.addIncident(event.incident);
        } else {
          console.log('⏭️ Skipping non-today incident:', event.incident.id);
        }
      } else {
        // Fallback: refresh from API if incident object not provided
        console.log('⚠️ No incident object in event, falling back to API refresh');
        this.refreshFromAPI();
      }
    });

    this.socket.on('incident_received', (event: IncidentReceivedEvent) => {
      console.log('✅ Incident received:', event);
      // Update incident status in our list
      this._liveIncidents.update(incidents =>
        incidents.map(i =>
          i.id === event.incidentId
            ? { ...i, status: IncidentStatus.RECEIVED, receivedAt: new Date(event.receivedAt) }
            : i
        )
      );
    });

    this.socket.on('incident_alarm', (event: IncidentAlarmEvent) => {
      console.log('🚨 ALARM:', event);
      this._lastAlarm.set(event);
      // Update incident status
      this._liveIncidents.update(incidents =>
        incidents.map(i =>
          i.id === event.incidentId
            ? { ...i, status: IncidentStatus.UNACCOUNTED }
            : i
        )
      );
    });

    this.socket.on('incident_resolved', (event: IncidentResolvedEvent) => {
      console.log('🔧 Incident resolved:', event);
      // Update incident status and resolvedAt in our list
      this._liveIncidents.update(incidents =>
        incidents.map(i =>
          i.id === event.incidentId
            ? { ...i, status: IncidentStatus.RESOLVED, resolvedAt: new Date(event.resolvedAt) }
            : i
        )
      );
      // Clear alarm if this was the alarming incident
      if (this._lastAlarm()?.incidentId === event.incidentId) {
        this._lastAlarm.set(null);
      }
    });

    this.socket.on('error', (err: any) => {
      console.error('WebSocket error:', err);
      this._connectionError.set(err.message || 'Unknown error');
    });

    this.socket.on('rule_triggered', (event: RuleTriggeredEvent) => {
      console.log('⚡ Rule triggered:', event);
      this._lastRuleTriggered.set(event);
    });

    this.socket.on('flag_resolved', (event: FlagResolvedEvent) => {
      console.log('✅ Flag resolved:', event);
      this._lastFlagResolved.set(event);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._connected.set(false);
      this._liveIncidents.set([]);
      this._lastAlarm.set(null);
      this._connectionError.set(null);
      console.log('🔌 WebSocket disconnected');
    }
  }

  // Refresh incidents from API (today-only)
  private refreshFromAPI(): void {
    this.http.get<{ data: Incident[] }>(`${this.apiUrl}/incidents?today=true`).subscribe({
      next: (response) => {
        console.log('🔄 Refreshed incidents from API:', response.data.length);
        this._liveIncidents.set(response.data);
      },
      error: (err) => {
        console.error('Failed to refresh incidents:', err);
      }
    });
  }

  // Set incidents from API (called by IncidentService)
  setIncidents(incidents: Incident[]): void {
    this._liveIncidents.set(incidents);
  }

  // Add single incident (with deduplication and today check)
  addIncident(incident: Incident): void {
    this._liveIncidents.update(list => {
      // Avoid duplicates
      const exists = list.find(i => i.id === incident.id);
      if (exists) return list;
      return [incident, ...list];
    });
  }

  // Update incident status
  updateIncidentStatus(id: string, status: IncidentStatus, extra?: Partial<Incident>): void {
    this._liveIncidents.update(incidents =>
      incidents.map(i => i.id === id ? { ...i, status, ...extra } : i)
    );
  }

  // Remove incident from list
  removeIncident(id: string): void {
    this._liveIncidents.update(incidents =>
      incidents.filter(i => i.id !== id)
    );
  }

  // Clear alarm
  clearAlarm(): void {
    this._lastAlarm.set(null);
  }

  // Utility: Check if a date is today
  private isToday(date: Date | string): boolean {
    const d = new Date(date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }

  // Utility: Get minutes since a date
  getMinutesSince(date: Date): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  }

  // Utility: Get seconds since a date
  getSecondsSince(date: Date): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
