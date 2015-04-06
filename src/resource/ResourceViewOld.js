var ResourceView = fcViews.resource = AgendaView.extend({ // extends AgendaView
    initialize: function() {
        AgendaView.prototype.initialize.apply(this, arguments)
    },

    cellToDate: function() {
        return this.start.clone()
    },

    resources: function() {
        this._resources = this._resources || this.calendar.fetchResources();
        return this._resources;
    },

    hasResource: function(event, resource) {
        if(this.opt('hasResource')) {
            return this.opt('hasResource').apply(this, arguments);
        }

        return event.resources && $.grep(event.resources, function(id) {
                return id == resource.id;
            }).length;
    },

    // Called when a new selection is made. Updates internal state and triggers handlers.
    reportSelection: function(start, end, ev, resources) {
        this.isSelected = true;

        this.calendar.trigger.apply(
            this.calendar, ['select', this, start, end, ev, this, resources]
        );
    },

    // Used by the `headHtml` method, via RowRenderer, for rendering the HTML of a day-of-week header cell
    headCellHtml: function(cell) {
        var resource
        var resources = this.resources();
        var classes = [
            'fc-day-header',
            this.widgetHeaderClass,
            'fc-' + dayIDs[cell.start.day()]
        ].join(' ');

        var header ='';
        if (resources.length) {
          for (var i = 0 ; i < resources.length; i++) {
            resource = resources[i]
            if (resource) {
              header += ''
              + '<th class="'+ classes +' '+resource.className+'">' 
              + htmlEscape(resource.name)
              + '</th>';
            }
          }
        } else {
          header += '<th class="'+ classes +'">' +'</th>'; 
        }


        return header;
    }

});
