/**
 * Servicio de geocodificación mediante Google Maps Geocoding API.
 * Convierte direcciones de texto en coordenadas (latitud/longitud)
 * restringiendo la búsqueda a Martos, Jaén, España.
 */
import { Injectable } from '@nestjs/common';

interface GeocodingResult {
  latitud: number;
  longitud: number;
}

@Injectable()
export class GeocodingService {
  // La API key se configura como variable de entorno GOOGLE_MAPS_API_KEY
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Centro de Martos y radio máximo permitido (5 km)
  private readonly MARTOS_LAT = 37.7210;
  private readonly MARTOS_LNG = -3.9720;
  private readonly MAX_RADIUS_KM = 5;

  /**
   * Calcula la distancia en km entre dos puntos usando la fórmula Haversine.
   */
  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Geocodifica una dirección restringida a Martos, Jaén.
   * Devuelve lat/lng si la dirección está dentro del radio de Martos,
   * o null si no es válida o está fuera del municipio.
   */
  async geocode(direccion: string): Promise<GeocodingResult | null> {
    const query = `${direccion}, Martos, Jaén, España`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${this.apiKey}&components=country:ES`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return null;
    }

    const location = data.results[0].geometry.location;

    // Verificar que las coordenadas están dentro del radio de Martos
    const distance = this.distanceKm(
      this.MARTOS_LAT, this.MARTOS_LNG,
      location.lat, location.lng,
    );

    if (distance > this.MAX_RADIUS_KM) {
      return null; // Dirección fuera de Martos
    }

    return {
      latitud: location.lat,
      longitud: location.lng,
    };
  }

  /**
   * Autocompletado de direcciones usando Google Places Autocomplete.
   * Se ejecuta desde el backend para no exponer la API Key en el frontend.
   */
  async autocomplete(input: string): Promise<{ description: string; placeId: string }[]> {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input + ', Martos')}&key=${this.apiKey}&components=country:es&location=37.7210,-3.9720&radius=5000&language=es&types=address`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.predictions?.length) {
      return [];
    }

    return data.predictions.map((p: any) => ({
      description: p.description,
      placeId: p.place_id,
    }));
  }
}
