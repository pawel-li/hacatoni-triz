import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiResponse } from '@nw/shared-types';
import { API_URL } from './api-url.token';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  imports: [RouterModule, CommonModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected title = 'frontend';
  public message = signal<string>('');
  
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  ngOnInit() {
    this.http.get<ApiResponse>(this.apiUrl).subscribe({
      next: (data) => this.message.set(`Backend says: ${data.message}`),
      error: () => {
        this.http.get<ApiResponse>('http://localhost:3004/greeting').subscribe({
          next: (data) => this.message.set(`Mock API says: ${data.message}`),
          error: (err) => {
            console.error('Both APIs failed', err);
            this.message.set('Error connecting to any API ❌');
          }
        });
      }
    });
  }
}
