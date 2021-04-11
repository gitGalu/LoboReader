# LoboReader
LoboReader is an unofficial reader for the Internet Archive "Magazine Rack". It:
* automatically remembers magazines we are reading, along with reading progress
* its viewer component supports standard touch-based gestures (pinch-to-zoom with panning, double-tap-to-zoom, swipe-to-turn-pages etc.)

LoboReader is available as a standalone, client-side, mobile web application (it needs to be added to your mobile OS "Homescreen"). LoboReader fetches all the data from the Internet Archive directly to your device, and only stores the reading progress information locally (on your device).

# Requirements:
* Safari on iPadOS 14+ and iOS 14+
* Google Chrome 87+ on Android

# Known issues
* Android only: cannot submit search queries when using GBoard keyboard w/ autocomplete enabled (as a workaround: try appending a dot after your input query, before tapping Enter)
* some Alpha transparency issues

# License
The source code license is MIT, as described in the LICENSE file.

# Built using or inspired by:
* [React](https://github.com/facebook/react)
* [Base Web React UI Framework](https://github.com/uber/baseweb)
* [Dexie](https://github.com/dfahlander/Dexie.js/)
* [PhotoSwipe](https://photoswipe.com)
* [React Lazy Load Image Component](https://github.com/Aljullu/react-lazy-load-image-component)
* [Internet Archive JavaScript Client](https://github.com/rchrd2/iajs)

