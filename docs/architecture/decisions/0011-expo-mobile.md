# 0011 - One React Native app for iOS and Android, built with Expo

**Status:** Proposed

## Decision
`apps/mobile` is an Expo app sharing `packages/core` with the web app. Builds
and store submission run through Expo's cloud build service; JavaScript fixes
ship as over-the-air updates within the stores' rules. Device calendars are
written through EventKit (expo-calendar), push through APNs and FCM.

## Why
One codebase for two stores, maintained by two people. Expo removes most native
build maintenance and does not block native code when it is needed. The native
app is also the only way to write to Apple Calendar immediately, and the only
place real microphone speech input can be tested properly.

## Consequences
Native-only features need a development build rather than Expo Go. Store
review and signing still require the founders' own developer accounts.
