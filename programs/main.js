import * as THREE from "./three.module.js";
import { OrbitControls } from "./OrbitControls.js"; 
import { OBJLoader } from './OBJLoader.js';
import { DoubleDepthBuffer } from "./doubleDepthBuffer.js";
import { Blit } from "./blit.js";
import { Skybox } from "./skybox.js";
import { SSRTGlass } from "./ssrtGlass.js";



window.addEventListener("load", init);

let scene; 
let camera;
let controls;
let renderer;


let ddbProgram;
let blitProgram;
let skyboxProgram;
let ssrtGlassProgram;

let dlCount = 0;


function init() {
    //THREE.Object3D.DefaultUp = new THREE.Vector3( 0, 0, 1 );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild( renderer.domElement );

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 1000 );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
	controls.dampingFactor = 0.0375;
    controls.enablePan = true;
	controls.panSpeed = 0.5;
    controls.screenSpacePanning = true;
    
    //controls.update() must be called after any manual changes to the camera's transform
    camera.position.set( 250, 250, 0 );
    controls.target.set( 0, 50, 0 );
    controls.update();



    
    let path = "assets/01BFD_blur.jpg";

    let radpath = path;

    // here's a list of good ones:
    let skybox = new THREE.TextureLoader().load(path, function(texture) {
        // ************    necessary to avoid seams in the equirectangular map !!    ***************
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        // ************ necessary to avoid seams in the equirectangular map !! - END ***************

        skybox = texture;
        onDlComplete();
    });

    let radbox = new THREE.TextureLoader().load(radpath, function(texture) {
        radbox = texture;
        radbox.wrapS = THREE.ClampToEdgeWrapping;
        radbox.wrapT = THREE.ClampToEdgeWrapping;
        radbox.magFilter = THREE.LinearMipmapLinearFilter;
        radbox.minFilter = THREE.LinearMipmapLinearFilter;
        onDlComplete();
    });

    let mesh;
    const loader = new OBJLoader();
    loader.load(
        "assets/model_.obj",
        function ( object ) {
            mesh = object.children[0];
            mesh.position.set(0,0,0);
            // mesh.rotation.x = Math.PI * 0.5;
            mesh.scale.set(1, 1, 1);
            // necessary since the mesh by default is rotated
            mesh.rotation.set(-0.5 * Math.PI,0,0);

            // manually recalculating normals & positions
            mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    let normals = child.geometry.attributes.normal.array;
                    for(let i = 0; i < normals.length; i+=3) {
                        let temp = normals[i+2];
                        normals[i+2] = normals[i+1]; 
                        normals[i+1] = -temp;
                    }

                    let positions = child.geometry.attributes.position.array;
                    for(let i = 0; i < positions.length; i+=3) {
                        let temp = positions[i+2];
                        positions[i+2] = positions[i+1]; 
                        positions[i+1] = -temp;
                    }
                }
            }); 

            onDlComplete();
        }
    );


    function onDlComplete() {
        dlCount++;
        if(dlCount < 3) return;

        // ************** THIS MESH IS CLONED INSIDE DDB & SSRT **************
        // let mesh = new THREE.Mesh(
        //     // new THREE.SphereBufferGeometry(0.5,15,15),
        //     // new THREE.BoxBufferGeometry(2,2,2),
        //     new THREE.TorusKnotBufferGeometry( 1, 0.45, 100, 16 ),
        //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
        // );
        scene.add(mesh);
        // ************** THIS MESH IS CLONED INSIDE DDB & SSRT - END **************
    
        blitProgram      = new Blit(renderer, "gl_FragColor = vec4(texture2D(uTexture, vUv).www, 1.0);");
        ddbProgram       = new DoubleDepthBuffer(mesh, camera, renderer);
        skyboxProgram    = new Skybox(skybox, camera, renderer);
        ssrtGlassProgram = new SSRTGlass(mesh, radbox, camera, renderer);
    
        animate();
    }
}

function animate(now) {
    now *= 0.001;

    requestAnimationFrame( animate );

    controls.update();  

    skyboxProgram.render();
    ddbProgram.compute(6);
    ssrtGlassProgram.render(now, ddbProgram.getBackFaceTexture(), ddbProgram.getFrontFaceTexture());
}

