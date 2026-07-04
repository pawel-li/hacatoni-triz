import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../api-url.token';
import { Prompt } from './types';

@Injectable({ providedIn: 'root' })
export class PromptApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getPrompt(id: string): Observable<Prompt> {
    return this.http.get<Prompt>(`${this.apiUrl}/prompts/${id}`);
  }

  createPrompt(text: string): Observable<Prompt> {
    return this.http.post<Prompt>(`${this.apiUrl}/prompts`, { text });
  }
}
