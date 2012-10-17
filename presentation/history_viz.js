onPage("history",_.once(function(){

var identity = function(x) { return x };

var Events = function() {
	this.listeners = {};
};

Events.prototype = {
	on: function(evt,fn,ctx) {
		this.listeners[evt] || (this.listeners[evt] = []);
		this.listeners[evt].push(_.bind(fn,ctx));
	},
	off: function() {
	},
	trigger: function(evt) {
		var args = [].slice(arguments,1);
		(this.listeners[evt] || []).forEach(function(fn) {
			fn.apply(null,args);
		});
	}
};

var tap = function() { debugger };

var plucker = function(v) {
	return function(o) {
		return o[v];
	}
};

var bcToAdDates = function(date) {
	var year = date > 0 ? date : date + "BC";
	return year;
};
	
var Model = function() {

	this.periods = [
		{name: "All time", years: [-14000,2000]},
		{name: "Ancient history", years: [-14000,-2000]},
		{name: "First civilisations", years: [-4000,2000]},
		{name: "1000BC - present", years: [-1000,2000]}
	];

	this.seriesList = [
		socDev.sum,
		socDev.eng,
		socDev.org,
		socDev.it,
		socDev.war,
		dateWpop
	];

	var makeDeltaDomain = function(series) {
		// we want it symetrical around the x-axis
		var extent = d3.extent(_.pluck(series,"value"));
		var magnitude = d3.max(_.map(extent,Math.abs));
		return [-magnitude,magnitude];
	};

	// TODO get scale for period viewed - allows a nice zoom
	var socDevScale = d3.extent(_.pluck(socDev.sum,"value"))
	socDevScale[0] = 1e-6;
	_.each(this.seriesList,function(s) {
		s.scale = d3.scale.log().domain(socDevScale);
	});
	dateWpop.scale = d3.scale.log().domain(d3.extent(_.pluck(dateWpop,"value")));

	var deltas = this.seriesList.map(function(series) {
		var changeSeries = _.sortBy(series,plucker("date")).reduce(function(state,row) {
			var prev = state.prev;	
			var delta = prev ? row.value - prev.value : 1e-6;
			state.change.push({
				date: row.date,
				value: delta === 0 ? 1e-6 : delta
			});
			state.prev = row;
			return state;
		},{change:[]}).change;
		changeSeries.name = series.name + " change";
		changeSeries.type = series.name;
		series.type = series.name;
		series.change = changeSeries;
		return changeSeries;
	});
	var socDevDeltaScale = makeDeltaDomain(deltas[0]);
	_.each(deltas,function(s) {
		s.scale = d3.scale.sqrt().domain(socDevDeltaScale);
	});
	var deltaWpop = deltas[deltas.length - 1];
	deltaWpop.scale = d3.scale.sqrt().domain(makeDeltaDomain(deltaWpop,"value"))

	var events = new Events();

	this.periodSelected = function(p) {
		this.period = p;
		events.trigger("change");
	};

	this.seriesToggled = function(s) {
		if(_.indexOf(this.plotted,s) === -1) {
			this.plotted.push(s);
		} else {
			this.plotted = _.without(this.plotted,s);
		}
		events.trigger("change");
	};

	this.absoluteChangeToggled = function(s) {
		this.absoluteOrChange = this.absoluteOrChange === "absolute" ? "change" : "absolute";
		events.trigger("change");
	};

	this.events = events;

	this.period = this.periods[0];
	this.plotted = [this.seriesList[0]];

	this.absoluteOrChange = "absolute";

	_.bindAll(this,"periodSelected","seriesToggled","absoluteChangeToggled");

};

var Visualisation = function(opts) {

	var width = opts.width,
			height = opts.height;

	var vm = opts.model;
	
	var root = d3.select("#history-viz")
								.append("div")
								.attr("id","chart-root")
								.style({
									width: width,
									height:height
								})
								;

	var chartElement = function() {
		return root
						.append("div")
							.attr("class","chart-element")
						.append("svg")
							.attr("width",width)
							.attr("height",height)
						.append("g")
							.attr("transform","translate(25,0)")
						;	
	};

	var chart = chartElement(),
			absoluteSeries = chartElement(),
			changeSeries = chartElement();

	var xScale = function() {
		return d3.scale.linear().domain(vm.period.years).range([0,width - 50]);
	}

	var xAxisFn = function() {
		return d3.svg.axis()
			.scale(xScale())
			.orient("bottom")
			.ticks(15)
			.tickFormat(bcToAdDates);
	};

	var xAxis = chart.append("g").attr("class","x-axis")
													 .attr("transform","translate(0," + (height - 25) + ")")
													 .call(xAxisFn());
	

	var color = d3.scale.category10().domain(_.pluck(vm.seriesList,"type"));
	this.plotSeries = function(plotted,y) {

		var change = _.pluck(plotted,"change");

		[[absoluteSeries,plotted],[changeSeries,change]].forEach(function(setup) {
			var el = setup[0];
			var plotted = setup[1];

			var s = el.selectAll(".series")
							 .data(plotted,function(s) { return s.name });

			var line = function(s) {
				var scale = s.scale.range([height-30,0]);
				return d3.svg.line()
						.x(_.compose(xScale(),plucker("date")))
						.y(_.compose(scale,plucker("value")))(s)
			};

			s.transition().attr("d",line);

			s.enter()
				.append("svg:path")
					.attr("class","series")
					.attr("d",line)
					.style("stroke",_.compose(color,plucker("type")))
					;

			s.exit().remove();


		});
		
	};


	this.render = function() {
		xAxis.transition().call(xAxisFn());
		this.plotSeries(vm.plotted);
		d3.selectAll([absoluteSeries.node().parentNode.parentNode,changeSeries.node().parentNode.parentNode])
			.data(["absolute","change"])
			.attr("class",function(d) {
				var base = "chart-element"
				return vm.absoluteOrChange === d ? base : base + " inactive-series";
			});
	};

	vm.events.on("change",this.render,this);

	this.render();


};


var SeriesControl = function(vm) {
	// check box per series
	// can't disable all

	var color = d3.scale.category10().domain(_.pluck(vm.seriesList,"type"));
	var controls = d3.select("#history-viz").append("ul").attr("id","series-control");
	
	this.render = function() {

		var bound = controls.selectAll("li")
				.data(vm.seriesList,plucker("name"));

		bound.enter()
				.append("li")
				.append("label")
					.text(plucker("name"))
					.on("change",vm.seriesToggled)
					.style("color",_.compose(color,plucker("type")))
				.append("input")
					.attr("name","series")
					.attr("type","checkbox")
					.attr("value",plucker("name"))
					.attr("checked",function(d) {
						return _.indexOf(vm.plotted,d) !== -1 ? "checked" : null;
					});

	};

	vm.events.on("change",this.render,this);

	this.render();

};

var PeriodControl = function(vm) {
	// set period
	
	var control = d3.select("#history-viz").append("ul")
		.attr("id","period-control");

	this.render = function() {
		var periods = control.selectAll("li")
										.data(vm.periods)
										.enter()
										.append("li")
										.text(plucker("name"))
										.on("click",vm.periodSelected);
	};

	vm.events.on("change",this.render,this);

	this.render();

};

var ChangeControl = function(vm) {
	// toggle change or absolute values
	d3.select("#history-viz")
		.append("button")
		.text("Toggle change/absolute")
		.on("click",vm.absoluteChangeToggled);
};

var boot = function() {
	var vm = new Model();
	var periodControl = PeriodControl(vm);
	var seriesControl = SeriesControl(vm);
	var changeControl = ChangeControl(vm);
	var vis = new Visualisation({model: vm, width: 1000, height: 300})
};

boot();

}));
