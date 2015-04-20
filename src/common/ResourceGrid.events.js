
ResourceGrid.mixin({
	// Given a cell to be dropped upon, and misc data associated with the jqui drag (guaranteed to be a plain object),
	// returns start/end dates for the event that would result from the hypothetical drop. end might be null.
	// Returning a null value signals an invalid drop cell.
	computeExternalDrop: function(cell, meta) {
		var dropLocation = {
			start: cell.start.clone(),
			end: null
		};

		// if dropped on an all-day cell, and element's metadata specified a time, set it
		if (meta.startTime && !dropLocation.start.hasTime()) {
			dropLocation.start.time(meta.startTime);
		}

		if (meta.duration) {
			dropLocation.end = dropLocation.start.clone().add(meta.duration);
		}

		if (meta.eventProps.resources) {
			dropLocation.event = {
				resources: meta.eventProps.resources
			}
		} else {
			meta.eventProps.tempResources = [cell.resource.id]
			dropLocation.event = {
				resources: [cell.resource.id]
			}
		}

		meta.eventProps.timeGuide = cell.timeGuide

		if (!this.view.calendar.isExternalDropRangeAllowed(dropLocation, meta.eventProps)) {
			return null;
		}

		return dropLocation;
	},

	computeEventDrop: function(startCell, endCell, event) {
		event.tempResources = [endCell.resource.id] //add resource data from the destination cell
		return Grid.prototype.computeEventDrop.call(this, startCell, endCell, event); // call the super-method
	},

	// Compute the text that should be displayed on an event's element.
	// `range` can be the Event object itself, or something range-like, with at least a `start`.
	// If event times are disabled, or the event has no time, will return a blank string.
	// If not specified, formatStr will default to the eventTimeFormat setting,
	// and displayEnd will default to the displayEventEnd setting.
	getEventTimeText: function(range, formatStr, displayEnd) {
		if (formatStr == null) {
			formatStr = this.eventTimeFormat;
		}

		if (displayEnd == null) {
			displayEnd = this.displayEventEnd;
		}

		if (this.displayEventTime && range.start.hasTime()) {
			if (displayEnd && range.end) {
				return this.view.formatRange(range, formatStr);
			}
			else {
				return range.start.format(formatStr);
			}
		}

		return '';
	},

	// Slices up a date range by column into an array of segments
	rangeToSegs: function(range) {
		var colCnt = this.colCnt;
		var segs = [];
		var seg;
		var col;
		var colDate;
		var colRange;
    var colRes;

		// normalize :(
		range.start = range.start.clone().stripZone()
		range.end = range.end.clone().stripZone()

		for (col = 0; col < colCnt; col++) {
          colRes = this.resources[col]
		  var hasResource = !!(range.event && range.event.resources && range.event.resources.indexOf(colRes.id) !== -1)
		  var hasTempResource = !!(range.event && range.event.tempResources && range.event.tempResources.indexOf(colRes.id) !== -1)
          if (hasResource || hasTempResource) {

            colDate = this.colData[col].day; // will be ambig time/timezone
            colRange = {
              start: colDate.clone().time(this.minTime),
              end: colDate.clone().time(this.maxTime)
            };
            seg = intersectionToSeg(range, colRange); // both will be ambig timezone
            if (seg) {
              seg.col = col;
              seg.color = colRes.color;
              segs.push(seg);
            }
          }
		}

		return segs;
	},

  eventsToSegs: function(events, rangeToSegsFunc) {
		var eventRanges = this.eventsToRanges(events);
		var segs = [];
		var i;

		for (i = 0; i < eventRanges.length; i++) {
			segs.push.apply(
				segs,
				this.eventRangeToSegs(eventRanges[i], rangeToSegsFunc)
			);
		}

		return segs;
  },

	// Slices the given event range into one or more segment objects.
	// A `rangeToSegsFunc` custom slicing function can be given.
	eventRangeToSegs: function(eventRange, rangeToSegsFunc) {
		var segs;
		var i, seg;

		if (rangeToSegsFunc) {
			segs = rangeToSegsFunc.call(this,eventRange);
		}
		else {
			segs = this.rangeToSegs(eventRange); // defined by the subclass
		}

		for (i = 0; i < segs.length; i++) {
			seg = segs[i];
			seg.event = eventRange.event;
			seg.eventStartMS = eventRange.eventStartMS;
			seg.eventDurationMS = eventRange.eventDurationMS;
		}

		return segs;
	},

	// Utility for generating event skin-related CSS properties
	getEventSkinCss: function(event, seg) {
    seg = seg || {};
		var view = this.view;
		var source = event.source || {};
    var segColor = seg.color;
		var eventColor = event.color;
		var sourceColor = source.color;
		var optionColor = view.opt('eventColor');

		return {
			'background-color':
				event.backgroundColor ||
				eventColor ||
				source.backgroundColor ||
				sourceColor ||
				seg.backgroundColor ||
				segColor ||
				view.opt('eventBackgroundColor') ||
				optionColor,
			'border-color':
				event.borderColor ||
				eventColor ||
				source.borderColor ||
				sourceColor ||
				seg.borderColor ||
				segColor ||
				view.opt('eventBorderColor') ||
				optionColor,
			color:
				event.textColor ||
				source.textColor ||
        seg.textColor ||
				view.opt('eventTextColor')
		};
	},

	expectedTimeText: function(start, end) {
		if (!start && !end) return ''

		var text = "<< Expected time: "
		if (start && !end) {
			text += "After "+start
		} else if (!start && end) {
			text += "Before "+start
		} else {
			text += start + " - " + end
		}

		return text + " >>"
	},

	// Renders the HTML for a single event segment's default rendering
	fgSegHtml: function(seg, disableResizing) {
		var view = this.view;
		var event = seg.event;
		var isDraggable = view.isEventDraggable(event);
		var isResizableFromStart = !disableResizing && seg.isStart && view.isEventResizableFromStart(event);
		var isResizableFromEnd = !disableResizing && seg.isEnd && view.isEventResizableFromEnd(event);
		var classes = this.getSegClasses(seg, isDraggable, isResizableFromStart || isResizableFromEnd);
		var skinCss = cssToStr(this.getEventSkinCss(event, seg));
		var timeText;
		var fullTimeText; // more verbose time text. for the print stylesheet
		var startTimeText; // just the start time text
		var expectedTime = this.expectedTimeText(event.expectedStart, event.expectedEnd)

		classes.unshift('fc-time-grid-event', 'fc-v-event');

		if (view.isMultiDayEvent(event)) { // if the event appears to span more than one day...
			// Don't display time text on segments that run entirely through a day.
			// That would appear as midnight-midnight and would look dumb.
			// Otherwise, display the time text for the *segment's* times (like 6pm-midnight or midnight-10am)
			if (seg.isStart || seg.isEnd) {
				timeText = this.getEventTimeText(seg);
				fullTimeText = this.getEventTimeText(seg, 'LT');
				startTimeText = this.getEventTimeText(seg, null, false); // displayEnd=false
			}
		} else {
			// Display the normal time text for the *event's* times
			timeText = this.getEventTimeText(event);
			fullTimeText = this.getEventTimeText(event, 'LT');
			startTimeText = this.getEventTimeText(event, null, false); // displayEnd=false
		}

		return '<a class="' + classes.join(' ') + '"' +
			(event.url ?
				' href="' + htmlEscape(event.url) + '"' :
				''
				) +
			(skinCss ?
				' style="' + skinCss + '"' :
				''
				) +
			'>' +
				'<div class="fc-content">' +
					(timeText ?
						'<div class="fc-time"' +
						' data-start="' + htmlEscape(startTimeText) + '"' +
						' data-full="' + htmlEscape(fullTimeText) + '"' +
						'>' +
							'<span>' + htmlEscape(timeText) + '</span>' +
							'<span class="fc-expected-time">' + htmlEscape(expectedTime) + '</span>'+
							'<span class="fc-event-remove" data-event-id="'+event._id+'">'+this.eventDeleteHtml+'</span>'+
						'</div>' :
						''
						) +
					(event.title ?
						'<div class="fc-title">' +
							htmlEscape(event.title) +
						'</div>' :
						''
						) +
				'</div>' +
				'<div class="fc-bg"/>' +
				/* TODO: write CSS for this
				(isResizableFromStart ?
					'<div class="fc-resizer fc-start-resizer" />' :
					''
					) +
				*/
				(isResizableFromEnd ?
					'<div class="fc-resizer fc-end-resizer" />' :
					''
					) +
			'</a>';
	}

});
