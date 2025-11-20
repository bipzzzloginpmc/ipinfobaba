import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IpAddressService, IpAddressInfo } from './ip-address.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly ipService = inject(IpAddressService);

  readonly title = signal('ipaddress');
  readonly ipInfo = signal<IpAddressInfo | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

// In app.ts
testWebRTC(): void {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  pc.createDataChannel('');
  pc.createOffer().then(offer => pc.setLocalDescription(offer));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('✅ ICE Candidate:', event.candidate.candidate);
    }
  };

  setTimeout(() => {
    pc.close();
    console.log('Test complete - check logs above');
  }, 3000);
}


  fetchIpAddresses(): void {
    console.log('🚀 Button clicked - fetching IPs...');
    
    this.isLoading.set(true);
    this.error.set(null);
    this.ipInfo.set(null); // Clear previous data

    this.ipService.getBothIpAddresses().subscribe({
      next: (info) => {
        console.log('📦 Received IP info:', info);
        this.ipInfo.set(info);
      },
      error: (err) => {
        console.error('💥 Subscription error:', err);
        this.error.set('Failed to fetch IP addresses: ' + err.message);
        this.isLoading.set(false);
      },
      complete: () => {
        console.log('✅ Subscription complete');
        this.isLoading.set(false);
      }
    });
  }
  
}