import { createHmac } from 'crypto';
import Router from './router';

const API_V1_URL = 'https://api.weatherlink.com/v1';
const API_V2_URL = 'https://api.weatherlink.com/v2';
const OPEN_WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';
const STATION_ID = '33062';

let parameters = new Map();
parameters.set('api-key', API_V2_KEY);
parameters.set('station-id', STATION_ID);

// Used in the request to the WeatherLink v2 API
const requestInit = { headers: {} };

/**
 * Used in the response that this Cloudflare worker sends back,
 * You need to use the Access-Control-Allow-Origin header to allow
 * this Cloudflare worker to be invoked by another domain
 */
const responseInit = {
  headers: {
    "Content-Type": "application/json;charset=UTF-8",
    "Access-Control-Allow-Origin": "*"
  }
};

// Process the incoming request to the Cloudflare worker
async function handleRequest(request) {
  const router = new Router();

  // Get current weather
  router.get('/', () => getCurrentWeather());
  router.get('/historic', () => getHistoricWeather());
  router.get('/station-data', () => getWeatherStationData());
  router.get('/forecast', () => getForecast());

  const response = await router.route(request);
  return response;
}

async function getWeatherStationData() {
  const finalUrl = API_V1_URL + '/NoaaExt.json' +
    `?user=${USER}` +
    `&pass=${PASSWORD}` +
    `&apiToken=${API_V1_KEY}`;

  // Make the WeatherLink v1 API call
  const response = await fetch(finalUrl, requestInit);
  // Get the response body
  const results = await gatherResponse(response);
  // Return the response from the WeatherLink v2 API
  return new Response(results, responseInit);
}

async function getCurrentWeather() {
  let params = ['api-key', 'station-id', 't'];
  const signature = generateSignature(params);

  const finalUrl = `${API_V2_URL}/current/${STATION_ID}` +
    '?api-key=' + API_V2_KEY +
    '&api-signature=' + signature + 
    '&t=' + parameters.get('t');

  // Make the WeatherLink v2 API call
  const response = await fetch(finalUrl, requestInit);
  // Get the response body
  const results = await gatherResponse(response);
  // Return the response from the WeatherLink v2 API
  return new Response(results, responseInit);
}

async function getHistoricWeather() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  let params = ['api-key', 'station-id', 't', 'start-timestamp', 'end-timestamp'];
  parameters.set('end-timestamp',  Math.floor(Date.now() / 1000).toString());
  parameters.set('start-timestamp', Math.floor((startDate.getTime() + 21600000) / 1000).toString());
  const signature = generateSignature(params);

  const finalUrl = `${API_V2_URL}/historic/${STATION_ID}` +
    '?api-key=' + API_V2_KEY +
    '&api-signature=' + signature + 
    '&t=' + parameters.get('t') +
    '&start-timestamp=' + parameters.get('start-timestamp') +
    '&end-timestamp=' + parameters.get('end-timestamp');

  console.log(finalUrl);

  // Make the WeatherLink v2 API call
  const response = await fetch(finalUrl, requestInit);
  // Get the response body
  const results = await gatherResponse(response);
  // Return the response from the WeatherLink v2 API
  return new Response(results, responseInit);
}

async function getForecast() {
  const finalUrl = `${OPEN_WEATHER_API_URL}/onecall?` +
    'lat=' + 42.84655 +
    '&lon=' + -88.74374 +
    '&exclude=' + 'hourly' +
    '&appid=' + OPEN_WEATHER_API_KEY;

  // Make the Open Weather Map API call
  const response = await fetch(finalUrl, requestInit);
  // Get the response body
  const results = await gatherResponse(response);
  // Return the response from the Open Weather Maps API
  return new Response(results, responseInit);
}

async function gatherResponse(response) {
  const { headers } = response;
  const contentType = headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json());
  } else if (contentType.includes("application/text")) {
    return await response.text();
  } else if (contentType.includes("text/html")) {
    return await response.text();
  } else {
    return await response.text();
  }
}

addEventListener('fetch', event => {
  return event.respondWith(handleRequest(event.request));
});

/**
 * Generate the hmac signature to prevent api tampering with
 * WeatherLink
 * @param {string} params list of parameters
 */
function generateSignature(params) {
  parameters.set('t', Math.floor(Date.now() / 1000).toString());
  var data = "";

  params.sort();

  for (var parameterName of params) {
    data = data + parameterName + parameters.get(parameterName);
  }

  var hmac = createHmac('sha256', API_V2_SECRET);
  hmac.update(data);

  return hmac.digest('hex');
}
