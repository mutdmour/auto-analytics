/* globals window, location, document */

import { trackEventWhenReady, trackPageWhenReady, identifyWhenReady } from './helpers';

import analytics from '../vendor/analytics.min';

// Make anayltics available globally in the console
window.analytics = analytics;

// Doing this because some weird things happen when we just pass settings as an
// argument to the functions below.
let SETTINGS = false;

// This is where analytics gets called...
const logPageLoad = (title, referrer) => {
  // Use setTimeout so it uses the location from after the route change
  setTimeout(() => {
    const page = {
      title,
      referrer,
      path: location.pathname,
      search: location.search,
      url: location.href,
    };

    // Track page on analytics
    trackPageWhenReady(page.title, page);
  }, 0);
};

// A simple wrapper to be explicit about doing the first page load...
const logFirstPageLoad = () => {
  logPageLoad(document.title, document.referrer);
};


//
// What we're doing here is Monkey Patching(tm) the window.history.pushState()
// function because, currently, the History API provides the 'popstate' event
// but this event only gets fired when history.back(), history.go() are called
// or the user uses the browser buttons, but NOT when history.pushState() is
// called.
//

const configurePageLoadTracking = () => {
  // Save reference to original pushState.
  const originalPushState = window.history.pushState;

  // Wrap original pushState to call new push state function
  // NOTE: this can't be an arrow function!
  window.history.pushState = function okgrowAnalyticsMonkeyPatchedPushState(...args) {
    // Make sure we catch any exception here so that we're sure to call the
    // originalPushState function (below)
    try {
      logPageLoad(document.title, location.href);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
    }

    // Call original pushState with incoming arguments
    return originalPushState.apply(window.history, args);
  };

  window.addEventListener('popstate', () => {
    logPageLoad(document.title, location.href);
  }, false);
};

const analyticsStartup = () => {
  if (SETTINGS) {
    // Pass a new object based on settings in case analytics wants or tries to
    // modify the settings object being passed.
    analytics.initialize(Object.assign({}, SETTINGS));

    if (SETTINGS.autorun !== false) {
      logFirstPageLoad();
      configurePageLoadTracking();
    }
  } else {
    console.error('Missing analyticsSettings in Meteor.settings.public'); // eslint-disable-line no-console
  }
};


//
// What we're doing here is hooking into the window.onload event to:
//
// a) log the first page load, and
// b) setup logging for subsequent page/history changes
//
// NOTE: One concern here is the following scenario:
//
//       1. This code loads
//       2. Some other code loads and replaces window.onload kicking us out
//          BEFORE our function can execute.
//
// Possible solution is that we make analyticsStartup() (above) a public API
// a developer can call to manually set this all up.
//

const bootstrapAnalytics = () => {
  const originalWindowOnLoad = window.onload;

  if (typeof originalWindowOnLoad === 'function') {
    window.onload = function okgrowAnalyticsMonkeyPatchedOnLoad(...args) {
      analyticsStartup(SETTINGS);
      originalWindowOnLoad.apply(this, args);
    };
  } else {
    window.onload = analyticsStartup;
  }
};

// Make analytics available as an export
export { analytics }; // eslint-disable-line import/prefer-default-export

// Make our helpers available
export { trackEventWhenReady, trackPageWhenReady, identifyWhenReady };

export default function (settings) {
  // Doing this because some weird things happen when we just pass this to
  // the functions above.
  SETTINGS = settings;
  // Set everything up...
  bootstrapAnalytics();
}
