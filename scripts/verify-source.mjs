import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const read = (name) => readFileSync(join(process.cwd(), name), 'utf8');
const json = (name) => JSON.parse(read(name));
const pkg = json('package.json');
const angular = json('angular.json');
json('tsconfig.json');
json('tsconfig.app.json');
json('tsconfig.spec.json');
json('proxy.conf.json');

for (const dep of ['@angular/core', '@angular/common', '@angular/router', '@angular/material']) {
  assert.match(pkg.dependencies[dep], /^\^22\./, `${dep} deve usare Angular 22`);
}
const build = angular.projects['bus-booking-web'].architect.build;
assert.equal(build.builder, '@angular/build:application');
assert.equal(angular.projects['bus-booking-web'].architect.test.builder, '@angular/build:unit-test');
assert.match(read('src/main.ts'), /bootstrapApplication\(AppComponent/);
assert.match(read('src/app/app.routes.ts'), /path: 'stops'/);
assert.match(read('src/app/app.routes.ts'), /path: 'stop'/);
assert.match(read('src/environments/environment.prod.ts'), /'\/busbooking\/api'/);
assert.match(read('src/environments/environment.ts'), /'\/api'/);
for (const asset of ['titolo.jpg', 'android-logo.png', 'satellite.png', 'orologio.png', 'booking_sfondo.png', 'suono.mp3', 'arrivo.mp3']) {
  assert.ok(existsSync(`src/assets/${asset}`), `Asset non trovato: ${asset}`);
}
assert.ok(!existsSync('src/app/app.module.ts'), 'NgModule legacy ancora presente');
assert.ok(!existsSync('karma.conf.js'), 'Karma legacy ancora presente');
console.log('Verifica statica BusBooking Web Angular 22: OK');
console.log('ATTENZIONE: questa verifica NON sostituisce npm install, npm run build e npm test.');
