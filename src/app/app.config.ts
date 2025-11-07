import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';


import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAgc0UhrDkD0iQWuSgsuY6t-7V8oZ5zVAc',
  authDomain: 'dabubble-group.firebaseapp.com',
  projectId: 'dabubble-group',
  storageBucket: 'dabubble-group.firebasestorage.app',
  messagingSenderId: '940020886287',
  appId: '1:940020886287:web:d5d8546fe0a9bb6bdd6c7a',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideAnimations(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};