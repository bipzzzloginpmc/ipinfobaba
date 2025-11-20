import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface IpAddressInfo {
  publicIp: string;
  privateIp: string;
  publicIpv6?: string; // New field
  webrtcPublicIp?: string; // New field
}

@Injectable({
  providedIn: 'root'
})
export class IpAddressService {
  private readonly http = inject(HttpClient);

  getPublicIp(): Observable<string> {
    return this.http.get<{ ip: string }>('https://api.ipify.org?format=json')
      .pipe(
        map(response => response.ip),
        catchError(() => of('Unable to fetch'))
      );
  }

  getPrivateIp(): Observable<string> {
    return from(this.detectPrivateIp());
  }

  private async detectPrivateIp(): Promise<string> {
    if (!navigator.onLine) {
      return 'Device is offline';
    }

    return new Promise((resolve) => {
      const RTCPeerConnection = (window as any).RTCPeerConnection ||
                                (window as any).mozRTCPeerConnection ||
                                (window as any).webkitRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve('WebRTC not supported');
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      let ipFound = false;
      const foundIps: string[] = [];

      pc.createDataChannel('');

      pc.createOffer()
        .then((offer: RTCSessionDescriptionInit) => pc.setLocalDescription(offer))
        .catch(() => resolve('Failed to create offer'));

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event || !event.candidate) {
          if (!ipFound) {
            resolve('Hidden by browser (mDNS)');
          }
          pc.close();
          return;
        }

        const candidate = event.candidate.candidate;
        
        // Match IPv4 addresses
        const ipv4Regex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
        const matches = candidate.match(ipv4Regex);

        if (matches) {
          matches.forEach(ip => {
            // Filter for PRIVATE IPs only
            if (ip.startsWith('192.168.') || 
                ip.startsWith('10.') || 
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
              if (!ipFound) {
                ipFound = true;
                resolve(ip);
                pc.close();
              }
            } else if (!ip.startsWith('0.') && 
                       !ip.startsWith('127.') && 
                       ip !== '255.255.255.255') {
              foundIps.push(ip);
            }
          });
        }
      };

      setTimeout(() => {
        if (!ipFound) {
          pc.close();
          resolve('Hidden by browser (mDNS)');
        }
      }, 4000);
    });
  }

  /**
   * NEW: Enhanced method to get all IPs including from WebRTC
   */
  /**
 * NEW: Enhanced method to get all IPs including from WebRTC
 */
getAllIpAddresses(): Observable<IpAddressInfo> {
  return forkJoin({
    publicIp: this.getPublicIp(),
    privateIp: this.getPrivateIp(),
    webrtcIps: from(this.getAllWebRTCIps())
  }).pipe(
    map(result => ({
      publicIp: result.publicIp,
      privateIp: result.privateIp,
      publicIpv6: result.webrtcIps.ipv6 ?? undefined,  // ← Convert null to undefined
      webrtcPublicIp: result.webrtcIps.publicIp ?? undefined  // ← Convert null to undefined
    }))
  );
}
  /**
   * Extract all IPs from WebRTC (including public IPs from srflx candidates)
   */
  private async getAllWebRTCIps(): Promise<{ publicIp: string | null; ipv6: string | null }> {
    return new Promise((resolve) => {
      const RTCPeerConnection = (window as any).RTCPeerConnection ||
                                (window as any).mozRTCPeerConnection ||
                                (window as any).webkitRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve({ publicIp: null, ipv6: null });
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      let publicIpv4: string | null = null;
      let publicIpv6: string | null = null;

      pc.createDataChannel('');
      pc.createOffer()
        .then((offer: RTCSessionDescriptionInit) => pc.setLocalDescription(offer))
        .catch(() => resolve({ publicIp: null, ipv6: null }));

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event || !event.candidate) {
          resolve({ publicIp: publicIpv4, ipv6: publicIpv6 });
          pc.close();
          return;
        }

        const candidate = event.candidate.candidate;

        // Extract IPv4 from srflx (server reflexive = public IP)
        if (candidate.includes('typ srflx')) {
          const ipv4Match = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (ipv4Match && !publicIpv4) {
            publicIpv4 = ipv4Match[0];
          }

          // Extract IPv6 from srflx
          const ipv6Match = candidate.match(/([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}/i);
          if (ipv6Match && !publicIpv6) {
            publicIpv6 = ipv6Match[0];
          }
        }
      };

      setTimeout(() => {
        resolve({ publicIp: publicIpv4, ipv6: publicIpv6 });
        pc.close();
      }, 4000);
    });
  }

  // Keep the old method for backward compatibility
  getBothIpAddresses(): Observable<IpAddressInfo> {
    return this.getAllIpAddresses();
  }
}