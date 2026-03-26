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

  /**
   * Geocodifica una dirección restringida a Martos, Jaén.
   * Devuelve lat/lng si la encuentra, o null si no es válida.
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
