onPage("three-d",_.once(function() {

var FIELD_OF_VIEW = 90, // telephoto (low) to wideangle (high)
		NEAR = 0.1,
		FAR = 10000;

var WIDTH = document.body.clientWidth, HEIGHT = document.body.clientHeight;

var container = document.body.querySelector("#three-demo");

var ASPECT_RATIO =  WIDTH / HEIGHT ;

var renderer = new THREE.WebGLRenderer();
var camera = new THREE.PerspectiveCamera(
	FIELD_OF_VIEW,
	ASPECT_RATIO,
	NEAR,
	FAR
);


var scene = new THREE.Scene();

scene.add(camera);

// look down from away and above
camera.position.z = 500;
camera.position.y = 500;
camera.lookAt(scene.position);

// visual ranges
var MAX_X = 500,
		MAX_Y = 200,
		MAX_Z = 500;


var light = new THREE.PointLight();
light.position.set( 0, 100, 0 );
scene.add(light);

// ready to go
renderer.setSize(WIDTH, HEIGHT);
container.appendChild(renderer.domElement);


var waiting = 3;
var onFinished = (function(done) {
	var waiting = 3;
	var data = {};
	return function(name,values,key) {
		_.each(values,function(row) {
			var id = parseInt(row.domain_id,10);
			data[id] = data[id] || {};
			data[id][name] = parseInt(row[key],10);
		});
		if(--waiting === 0) done(data);
	}
})(function(data) {

	var scales = [["impressions",MAX_X],["clicks",MAX_Z],["orders",MAX_Y]].reduce(function(x,kv) {
		var key = kv[0], rangeMax = kv[1];
		x[key] = d3.scale.linear().domain(d3.extent(_.pluck(data,key))).range([0,rangeMax]);
		return x;
	},{});

	_.each(data,function(datum) {

		setTimeout(function() {

			var point = new THREE.Mesh(
				new THREE.SphereGeometry( 5, 16	, 16 ),
				new THREE.MeshLambertMaterial({
					color: 0xFF0000
				})
			);

			[["impressions","x"],["clicks","z"],["orders","y"]].forEach(function(pair) {
				var key = pair[0], dim = pair[1];
				datum[key] || (datum[key] = Math.round(Math.random() * scales[key].domain()[1]));
				point.position[dim] = scales[key](datum[key]);
			});
		
			scene.add(point);

		});


	});

	renderer.render(scene,camera);

});

d3.tsv("clicks_new.tsv",function(imps) {
	onFinished("clicks",imps,"clicks_on_domain");
});
d3.tsv("impressions_new.tsv",function(imps) {
	onFinished("impressions",imps,"impressions");
});
d3.tsv("order_amounts_new.tsv",function(imps) {
	onFinished("orders",imps,"sum(order_amount)");
});

// gives us access to delta time for updates
var clock = new THREE.Clock();

var tick = function(t) {
	requestAnimationFrame( tick );
	controls.update(clock.getDelta());
	renderer.render( scene, camera );
};

document.addEventListener("DOMContentLoaded",function() {
	controls = new THREE.TrackballControls( camera , container );
	controls.movementSpeed = 0.01;
	controls.lookSpeed = 0.01;
	tick();
});

}));

