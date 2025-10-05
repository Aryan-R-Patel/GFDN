// GlobeView.jsx
import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { csvParseRows } from 'd3-dsv';
import indexBy from 'index-array-by';

const COUNTRY = 'United States';
const OPACITY = 0.45;
const ROUTE_SAMPLE_LIMIT = 350;
const AIRPORT_SAMPLE_LIMIT = 400;

function sampleRoutes(routes, limit) {
  if (routes.length <= limit) return routes;
  const sampled = [];
  const step = Math.ceil(routes.length / limit);
  for (let i = 0; i < routes.length && sampled.length < limit; i += step) {
    sampled.push(routes[i]);
  }
  return sampled;
}

const airportParse = ([
  airportId,
  name,
  city,
  country,
  iata,
  icao,
  lat,
  lng,
  alt,
  timezone,
  dst,
  tz,
  type,
  source
]) => ({
  airportId,
  name,
  city,
  country,
  iata,
  icao,
  lat,
  lng,
  alt,
  timezone,
  dst,
  tz,
  type,
  source
});

const routeParse = ([
  airline,
  airlineId,
  srcIata,
  srcAirportId,
  dstIata,
  dstAirportId,
  codeshare,
  stops,
  equipment
]) => ({
  airline,
  airlineId,
  srcIata,
  srcAirportId,
  dstIata,
  dstAirportId,
  codeshare,
  stops,
  equipment
});

export default function GlobeView() {
  const globeEl = useRef(null);
  const [airports, setAirports] = useState([]);
  const [routes, setRoutes] = useState([]);

  // Cleanup timeout on unmount
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat')
        .then(res => res.text())
        .then(data => csvParseRows(data, airportParse)),
      fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat')
        .then(res => res.text())
        .then(data => csvParseRows(data, routeParse))
    ])
      .then(([airportRows, routeRows]) => {
        if (!isMounted) return;

        const byIata = indexBy(airportRows, 'iata', false);

        const filteredRoutes = routeRows
          .filter(route => byIata.hasOwnProperty(route.srcIata) && byIata.hasOwnProperty(route.dstIata))
          .filter(route => route.stops === '0')
          .map(route => ({
            ...route,
            srcAirport: byIata[route.srcIata],
            dstAirport: byIata[route.dstIata],
            dashGapSeed: Math.random()
          }))
          .filter(route => route.srcAirport.country === COUNTRY && route.dstAirport.country !== COUNTRY);

        const sampledRoutes = sampleRoutes(filteredRoutes, ROUTE_SAMPLE_LIMIT);
        const airportsInRoutes = new Set();
        sampledRoutes.forEach(route => {
          airportsInRoutes.add(route.srcAirport.iata);
          airportsInRoutes.add(route.dstAirport.iata);
        });

        const sampledAirports = airportRows
          .filter(airport => airportsInRoutes.has(airport.iata))
          .slice(0, AIRPORT_SAMPLE_LIMIT);

        setAirports(sampledAirports);
        setRoutes(sampledRoutes);
      })
      .catch(err => {
        console.error('Failed to load globe data', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!globeEl.current) return;
    const timeout = setTimeout(() => {
      globeEl.current?.pointOfView({ lat: 39.6, lng: -98.5, altitude: 2 }, 1000);
    }, 300);

    return () => clearTimeout(timeout);
  }, [routes.length]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#000'
      }}
    >
      <Globe
        ref={globeEl}
        globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
        backgroundColor="rgba(0,0,0,1)"
        arcsData={routes}
        arcLabel={route => `${route.airline}: ${route.srcIata} &#8594; ${route.dstIata}`}
        arcStartLat={route => +route.srcAirport.lat}
        arcStartLng={route => +route.srcAirport.lng}
        arcEndLat={route => +route.dstAirport.lat}
        arcEndLng={route => +route.dstAirport.lng}
        arcDashLength={0.25}
        arcDashGap={1}
  arcDashInitialGap={route => route.dashGapSeed ?? 0}
        arcDashAnimateTime={4000}
        arcColor={() => [
          `rgba(0, 255, 0, ${OPACITY})`,
          `rgba(255, 0, 0, ${OPACITY})`
        ]}
        arcsTransitionDuration={0}
        pointsData={airports}
        pointColor={() => 'orange'}
        pointAltitude={0}
        pointRadius={0.02}
        pointsMerge
      />
    </div>
  );
}