#!/usr/bin/env node

/**
 * DeliveryOS Realtime Matrix Verification Gate
 *
 * Statically parses all WebSocket server emitters, server @SubscribeMessage handlers,
 * and client listeners / emitters across the monorepo:
 * - services/backend_api (TrackingGateway, RiderService, OrderService, PaymentsService, AdminService)
 * - apps/admin_portal
 * - apps/vendor_portal
 * - apps/customer_app
 * - apps/rider_app
 *
 * Verifies:
 * 1. Server-to-Client Emitters have active Client Listeners.
 * 2. Client-to-Server Ingress Emitters have matching @SubscribeMessage handlers in TrackingGateway.
 * 3. Client socket listeners have matching server emitters (zero dead listeners).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(process.cwd());

function walkFiles(dir, extensions) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.dart_tool' || entry === 'build') {
        continue;
      }
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkFiles(fullPath, extensions));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist or be inaccessible
  }
  return results;
}

// 1. Scan Backend: Server -> Client Emitters & Client -> Server Subscribers
const backendFiles = walkFiles(join(REPO_ROOT, 'services/backend_api/src'), ['.ts']);
const serverEmittedEvents = new Map(); // eventName -> Set of locations
const serverSubscribedEvents = new Map(); // eventName -> Set of locations

for (const file of backendFiles) {
  const content = readFileSync(file, 'utf-8');
  const relFile = file.replace(REPO_ROOT + '/', '');

  // Match .emit('event:name'
  const emitRegex = /\.emit\(\s*['"]([a-zA-Z0-9_:-]+)['"]/g;
  let match;
  while ((match = emitRegex.exec(content)) !== null) {
    const event = match[1];
    if (!serverEmittedEvents.has(event)) {
      serverEmittedEvents.set(event, new Set());
    }
    serverEmittedEvents.get(event).add(relFile);
  }

  // Match @SubscribeMessage('event:name')
  const subscribeRegex = /@SubscribeMessage\(\s*['"]([a-zA-Z0-9_:-]+)['"]\)/g;
  while ((match = subscribeRegex.exec(content)) !== null) {
    const event = match[1];
    if (!serverSubscribedEvents.has(event)) {
      serverSubscribedEvents.set(event, new Set());
    }
    serverSubscribedEvents.get(event).add(relFile);
  }
}

// 2. Scan Clients: Socket Listeners and Socket Emitters
const clientFiles = [
  ...walkFiles(join(REPO_ROOT, 'apps/admin_portal/src'), ['.ts', '.tsx']),
  ...walkFiles(join(REPO_ROOT, 'apps/vendor_portal/src'), ['.ts', '.tsx']),
  ...walkFiles(join(REPO_ROOT, 'apps/customer_app/lib'), ['.dart']),
  ...walkFiles(join(REPO_ROOT, 'apps/rider_app/lib'), ['.dart']),
];

const clientListenedEvents = new Map(); // eventName -> Set of locations
const clientEmittedEvents = new Map(); // eventName -> Set of locations

for (const file of clientFiles) {
  const content = readFileSync(file, 'utf-8');
  const relFile = file.replace(REPO_ROOT + '/', '');

  // Match socket.on('event:name' or socket?.on or _socket.on or _socket!.on
  const onRegex = /(?:socket|getSocket\(\)|_socket|_socket!)\.on\(\s*['"]([a-zA-Z0-9_:-]+)['"]/g;
  let match;
  while ((match = onRegex.exec(content)) !== null) {
    const event = match[1];
    if (!clientListenedEvents.has(event)) {
      clientListenedEvents.set(event, new Set());
    }
    clientListenedEvents.get(event).add(relFile);
  }

  // Match ORDER_SOCKET_EVENTS = ['order:new', ...] or useSocketSubscription(['order:new', ...])
  const hookArrayRegex = /(?:useSocketSubscription|useSocketQueryInvalidation|ORDER_SOCKET_EVENTS\s*=\s*\[)\s*\[?([^\]]+)\]?/g;
  while ((match = hookArrayRegex.exec(content)) !== null) {
    const rawEvents = match[1];
    const eventRegex = /['"](order:[a-zA-Z0-9_:-]+|dispatch:[a-zA-Z0-9_:-]+|rider:[a-zA-Z0-9_:-]+|vendor:[a-zA-Z0-9_:-]+)['"]/g;
    let evMatch;
    while ((evMatch = eventRegex.exec(rawEvents)) !== null) {
      const event = evMatch[1];
      if (!clientListenedEvents.has(event)) {
        clientListenedEvents.set(event, new Set());
      }
      clientListenedEvents.get(event).add(relFile);
    }
  }

  // Match socket.emit('event:name' or _socket.emit
  const clientEmitRegex = /(?:socket|_socket|_socket!)\.emit\(\s*['"]([a-zA-Z0-9_:-]+)['"]/g;
  while ((match = clientEmitRegex.exec(content)) !== null) {
    const event = match[1];
    if (!clientEmittedEvents.has(event)) {
      clientEmittedEvents.set(event, new Set());
    }
    clientEmittedEvents.get(event).add(relFile);
  }
}

// Infrastructure events
const SYSTEM_IGNORED_EMITS = new Set(['connected', 'error', 'pong']);
const SYSTEM_IGNORED_LISTENERS = new Set(['connect', 'disconnect', 'error', 'reconnect_attempt', 'reconnect']);

const ALIASES = {
  'order:status_changed': 'order:status:changed',
};

// 3. Verification Report
console.log('⚡ DeliveryOS Realtime WebSocket Matrix Audit:\n');

let hasErrors = false;

// Channel 1: Server -> Client
console.log('--- Channel 1: Server -> Client Domain Events ---');
const allServerEmits = Array.from(serverEmittedEvents.keys()).filter((e) => !SYSTEM_IGNORED_EMITS.has(e));

for (const event of allServerEmits) {
  const directListeners = clientListenedEvents.get(event);
  const aliasListeners = Object.entries(ALIASES)
    .filter(([alias, canonical]) => canonical === event)
    .flatMap(([alias]) => Array.from(clientListenedEvents.get(alias) || []));

  const totalListeners = [...(directListeners ? Array.from(directListeners) : []), ...aliasListeners];

  if (totalListeners.length === 0) {
    console.error(`❌ ORPHAN SERVER EMIT: Event '${event}' is emitted by backend but has ZERO client listeners!`);
    console.error(`   Emitters: ${Array.from(serverEmittedEvents.get(event)).join(', ')}`);
    hasErrors = true;
  } else {
    console.log(`✔ [SERVER -> CLIENT] '${event}'`);
    console.log(`   Emitters:  ${Array.from(serverEmittedEvents.get(event)).join(', ')}`);
    console.log(`   Listeners: ${Array.from(new Set(totalListeners)).join(', ')}\n`);
  }
}

// Check for dead client listeners
for (const [event, locations] of clientListenedEvents.entries()) {
  if (SYSTEM_IGNORED_LISTENERS.has(event)) continue;
  const canonical = ALIASES[event] || event;
  if (!serverEmittedEvents.has(canonical)) {
    console.error(`❌ DEAD CLIENT LISTENER: Client listens to '${event}', but backend NEVER emits this event!`);
    console.error(`   Locations: ${Array.from(locations).join(', ')}`);
    hasErrors = true;
  }
}

// Channel 2: Client -> Server
console.log('--- Channel 2: Client -> Server Ingress Events ---');
for (const [event, locations] of clientEmittedEvents.entries()) {
  if (!serverSubscribedEvents.has(event)) {
    console.error(`❌ UNHANDLED CLIENT EMIT: Client emits '${event}', but backend Gateway has no @SubscribeMessage('${event}')!`);
    console.error(`   Locations: ${Array.from(locations).join(', ')}`);
    hasErrors = true;
  } else {
    console.log(`✔ [CLIENT -> SERVER] '${event}'`);
    console.log(`   Client Emitted: ${Array.from(locations).join(', ')}`);
    console.log(`   Gateway Handle: ${Array.from(serverSubscribedEvents.get(event)).join(', ')}\n`);
  }
}

if (hasErrors) {
  console.error('\n💥 Realtime Matrix verification FAILED. Please reconcile socket events.');
  process.exit(1);
} else {
  console.log('✨ All realtime domain events verified with bi-directional contract parity!');
  process.exit(0);
}
