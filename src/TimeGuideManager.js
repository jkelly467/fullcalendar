function TimeGuideManager(options) {

  var t = this;

  t.fetchTimeGuides = fetchTimeGuides;
  t.findTimeGuideByStart = findTimeGuideByStart;

  var timeGuideSources = options.timeGuides;

  function fetchTimeGuides() {
    return timeGuideSources;
  }

  function findTimeGuideByStart(start) {
    var guide;
    
    for (var i = 0; i < timeGuideSources.length; i++) {
      guide = timeGuideSources[i];
      if (guide.start === start) {
        return guide;
      }
    }
    return null;
  }
};
