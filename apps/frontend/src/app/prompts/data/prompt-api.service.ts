import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../api-url.token';
import { Prompt, PromptListResponse, PromptRunEvent } from './types';

@Injectable({ providedIn: 'root' })
export class PromptApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getPrompts(options: {
    cursor?: string | null;
    search?: string;
    take?: number;
  } = {}): Observable<PromptListResponse> {
    let params = new HttpParams();

    if (options.cursor) params = params.set('cursor', options.cursor);
    if (options.search) params = params.set('search', options.search);
    if (options.take) params = params.set('take', options.take);

    return this.http.get<PromptListResponse>(`${this.apiUrl}/prompts`, {
      params,
    });
  }

  getPrompt(id: string): Observable<Prompt> {
    return this.http.get<Prompt>(`${this.apiUrl}/prompts/${id}`);
  }

  createPrompt(text: string, method: string = 'biomimicry'): Observable<Prompt> {
    return this.http.post<Prompt>(`${this.apiUrl}/prompts`, { text, method });
  }

  getRunEvents(promptId: string, runId: string): Observable<PromptRunEvent[]> {
    return this.http.get<PromptRunEvent[]>(
      `${this.apiUrl}/prompts/${encodeURIComponent(promptId)}/runs/${encodeURIComponent(runId)}/events`,
    );
  }

  streamPromptRun(id: string): Observable<PromptRunEvent> {
    return new Observable<PromptRunEvent>((subscriber) => {
      const eventSource = new EventSource(
        `${this.apiUrl}/prompts/${encodeURIComponent(id)}/run/stream`,
      );

      eventSource.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as PromptRunEvent;
          subscriber.next(event);

          if (event.type === 'run_completed' || event.type === 'error') {
            subscriber.complete();
            eventSource.close();
          }
        } catch (error) {
          subscriber.error(error);
        }
      };

      eventSource.onerror = () => {
        subscriber.error(new Error('Prompt run stream disconnected.'));
        eventSource.close();
      };

      return () => eventSource.close();
    });
  }
}
