function TimeGuideManager(options) {

    var t = this;

    t.fetchTimeGuides = fetchTimeGuides;
    t.findTimeGuideByStart = findTimeGuideByStart;
    t.findTimeGuideContaining = findTimeGuideContaining;

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

    function findTimeGuideContaining(date) {
        var guide, startM, endM;

        for (var i = 0; i < timeGuideSources.length; i++) {
            guide = timeGuideSources[i];
            startM = moment(guide.start, "HH:mm");
            endM = moment(guide.end, "HH:mm");

            startM = date.clone().startOf('day').hour(startM.hour()).minute(startM.minute())
            endM = date.clone().startOf('day').hour(endM.hour()).minute(endM.minute())

            if (date.isSame(startM) || date.isBetween(startM, endM)) {
                return guide;
            }
        }

        return null;
    }
};
