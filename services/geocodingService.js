const Nominatim = require('nominatim-geocoder');

const geocoder = new Nominatim({
  delay: 1000,
  secure: true,
  customUrl: 'https://nominatim.openstreetmap.org'
});

// Forward geocoding: Address to coordinates
export const geocodeAddress = async (address) => {
  try {
    const results = await geocoder.search({ q: address });
    
    if (results && results.length > 0) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
        displayName: results[0].display_name,
        address: results[0]
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
};

// Reverse geocoding: Coordinates to address
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const results = await geocoder.reverse({ lat: latitude, lon: longitude });
    
    if (results && results.length > 0) {
      const address = results[0].address;
      return {
        displayName: results[0].display_name,
        road: address.road,
        suburb: address.suburb,
        city: address.city || address.town || address.village,
        province: address.state,
        country: address.country,
        postcode: address.postcode,
        fullAddress: results[0]
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
};

// Find town/city from coordinates
export const getTownFromCoordinates = async (latitude, longitude) => {
  try {
    const result = await reverseGeocode(latitude, longitude);
    return result?.city || null;
  } catch (error) {
    console.error('Error getting town:', error);
    return null;
  }
};
