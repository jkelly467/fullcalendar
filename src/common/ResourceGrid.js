
/* A component that renders one or more columns of vertical time slots
----------------------------------------------------------------------------------------------------------------------*/

var ResourceGrid = TimeGrid.extend({

	slotDuration: null, // duration of a "slot", a distinct time segment on given day, visualized by lines
	snapDuration: null, // granularity of time for dragging and selecting

	minTime: null, // Duration object that denotes the first visible time of any given day
	maxTime: null, // Duration object that denotes the exclusive visible end time of any given day

	axisFormat: null, // formatting string for times running along vertical axis

	dayEls: null, // cells elements in the day-row background
	slatEls: null, // elements running horizontally across all columns

	slatTops: null, // an array of top positions, relative to the container. last item holds bottom of last slot

	helperEl: null, // cell skeleton element for rendering the mock event "helper"

	businessHourSegs: null,


	constructor: function() {
		TimeGrid.apply(this, arguments); // call the super-constructor
		this.processOptions();
	},


	/* Cell System
	------------------------------------------------------------------------------------------------------------------*/


	// Initializes row/col information
	updateCells: function() {
		var view = this.view;
		var colData = [];
		var date;

		date = this.start.clone();
		this.resources = view.resources()
		while (date.isBefore(this.end)) {
			for ( var i = 0; i < this.resources.length; i++) {
				colData.push({
					resource: this.resources[i],
					day: date.clone()
				});
			}
			date.add(1, 'day');
			date = view.skipHiddenDays(date);
		}

		if (this.isRTL) {
			colData.reverse();
		}

		this.colData = colData;
		this.colCnt = this.resources.length;
		this.rowCnt = Math.ceil((this.maxTime - this.minTime) / this.snapDuration); // # of vertical snaps
	},


	// Given a cell object, generates its start date. Returns a reference-free copy.
	computeCellDate: function(cell) {
		var time = this.computeSnapTime(cell.row);

		return this.view.calendar.rezoneDate(cell.day).time(time);
	},


	// Retrieves the element representing the given column
	getColEl: function(col) {
		return this.dayEls.eq(col);
	},

	// Renders the basic HTML skeleton for the grid
	renderHtml: function() {
		return '' +
			'<div class="fc-bg">' +
				'<table>' +
					this.rowHtml('slotBg') + // leverages RowRenderer, which will call slotBgCellHtml
				'</table>' +
			'</div>' +
			'<div class="fc-slats">' +
				'<table>' +
					this.slatRowHtml() +
				'</table>' +
			'</div>' +
            '<div class="fc-time-guides">' +
                '<table>' +
                    this.timeGuideHtml({labels:false}) +
                '</table>' +
            '</div> '+
            '<div class="fc-time-guide-labels">' +
                this.timeGuideHtml({labels:true}) +
            '</div>';
	},

  timeGuideHtml: function(guideConfig) {
    function fillerRow() {
      return '<tr><td class="fc-time-guide-filler"></td></tr>';
    }
    function divFiller() {
	  return '<div class="fc-time-guide-label-filler"></div>';
  	}

    var view = this.view;
    var html = '';
    var slotNormal = this.slotDuration.asMinutes() % 15 === 0;
    var slotTime = moment.duration(+this.minTime);
    var slotDate;
    var nextSlotDate;
    var formatTime;
    var formatNextTime;
    var delayTimeIncrement = false;
    var timeGuides = view.timeGuide();

    var startedGuide;
    var rows = 0;

    while (slotTime < this.maxTime) {
      slotDate = this.start.clone().time(slotTime);
      nextSlotDate = this.start.clone().time(slotTime);
      nextSlotDate.add(this.slotDuration);

      formatTime = slotDate.format('HH:mm');
      formatNextTime = nextSlotDate.format('HH:mm');
      
      if (!startedGuide) {
        //if we're not currently rendering a guide, look for one that starts at this time
        startedGuide = view.timeGuideByStart(formatTime);
      }

      if (startedGuide) { //if we're rendering a guide
        if (startedGuide.start === formatTime) {
          //if this is the start time of the guide, render the starting row

          if (guideConfig.labels) {
			  var width = Math.abs(moment(startedGuide.start, 'HH:mm').diff(moment(startedGuide.end,'HH:mm'), 'hours', true))*2*22
              html += '<div class="fc-time-guide-label" style="width:'+width+'px;">' +
              '<span>' + startedGuide.name + '</span>' +
              '</div>'
          } else {
			  html += '<tr><td class="fc-time-guide-filler fc-time-guide-top"></td></tr>';
		  }

        } else if (startedGuide.end === formatNextTime) {
          //if this is the end time of the guide, render the ending row
		  if (guideConfig.labels) {
			  html += divFiller()
		  }	else {
			  html += '<tr><td class="fc-time-guide-filler fc-time-guide-bottom"></td></tr>';
		  }

          startedGuide = null;
        } else {
          //if this is between the start and end of the guide, render a filler row
          
          html += guideConfig.labels ? divFiller() : fillerRow();
        }
      } else {
        //if we're between defined guides, render a filler row

        html += guideConfig.labels ? divFiller() : fillerRow();
      }

      slotTime.add(this.slotDuration);

    }

    return html;

  },


	/* Dates
	------------------------------------------------------------------------------------------------------------------*/


	// Given a row number of the grid, representing a "snap", returns a time (Duration) from its start-of-day
	computeSnapTime: function(row) {
		return moment.duration(this.minTime + this.snapDuration * row);
	},


	/* Event Drag Visualization
	------------------------------------------------------------------------------------------------------------------*/


	// Renders a visual indication of an event being dragged over the specified date(s).
	// dropLocation's end might be null, as well as `seg`. See Grid::renderDrag for more info.
	// A returned value of `true` signals that a mock "helper" event has been rendered.
	renderDrag: function(dropLocation, seg) {

		if (seg) { // if there is event information for this drag, render a helper event
			this.renderRangeHelper(dropLocation, seg);
			this.applyDragOpacity(this.helperEl);

			return true; // signal that a helper has been rendered
		}
		else {
			// otherwise, just render a highlight
			this.renderHighlight(
				this.view.calendar.ensureVisibleEventRange(dropLocation) // needs to be a proper range
			);
		}
	},


	// Unrenders any visual indication of an event being dragged
	destroyDrag: function() {
		this.destroyHelper();
		this.destroyHighlight();
	},


	/* Event Helper
	------------------------------------------------------------------------------------------------------------------*/


	// Renders a mock "helper" event. `sourceSeg` is the original segment object and might be null (an external drag)
	renderHelper: function(event, sourceSeg) {
		var segs = this.eventsToSegs([ event ]);
		var tableEl;
		var i, seg;
		var sourceEl;

		segs = this.renderFgSegEls(segs); // assigns each seg's el and returns a subset of segs that were rendered
		tableEl = this.renderSegTable(segs);

		// Try to make the segment that is in the same row as sourceSeg look the same
		for (i = 0; i < segs.length; i++) {
			seg = segs[i];
			if (sourceSeg && sourceSeg.col === seg.col) {
				sourceEl = sourceSeg.el;
				seg.el.css({
					left: sourceEl.css('left'),
					right: sourceEl.css('right'),
					'margin-left': sourceEl.css('margin-left'),
					'margin-right': sourceEl.css('margin-right')
				});
			}
		}

		this.helperEl = $('<div class="fc-helper-skeleton"/>')
			.append(tableEl)
				.appendTo(this.el);
	},


	// Unrenders any mock helper event
	destroyHelper: function() {
		if (this.helperEl) {
			this.helperEl.remove();
			this.helperEl = null;
		}
	}


});
