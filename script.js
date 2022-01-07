window.onload = function() {


    function getVolume(geometry) {
        if (!geometry.isBufferGeometry) {
          console.log("'geometry' must be an indexed or non-indexed buffer geometry");
          return 0;
        }
        var isIndexed = geometry.index !== null;
        let position = geometry.attributes.position;
        let sum = 0;
        let p1 = new THREE.Vector3(),
          p2 = new THREE.Vector3(),
          p3 = new THREE.Vector3();
        if (!isIndexed) {
          let faces = position.count / 3;
          for (let i = 0; i < faces; i++) {
            p1.fromBufferAttribute(position, i * 3 + 0);
            p2.fromBufferAttribute(position, i * 3 + 1);
            p3.fromBufferAttribute(position, i * 3 + 2);
            sum += signedVolumeOfTriangle(p1, p2, p3);
          }
        }
        else {
          let index = geometry.index;
          let faces = index.count / 3;
          for (let i = 0; i < faces; i++){
            p1.fromBufferAttribute(position, index.array[i * 3 + 0]);
            p2.fromBufferAttribute(position, index.array[i * 3 + 1]);
            p3.fromBufferAttribute(position, index.array[i * 3 + 2]);
            sum += signedVolumeOfTriangle(p1, p2, p3);
          }
        }
        return sum;
      }
    
      function signedVolumeOfTriangle(p1, p2, p3) {
        return p1.dot(p2.cross(p3)) / 6.0;
      }

    //Constant Variables
    const cameraLength = 10;
    const rotationSpeed = 2;
    const nRT = 1.4 * 287 * 298;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    let mouse = new THREE.Vector2();
    let previousMouse = new THREE.Vector2();
    let theta = 0.; // Camera Position about center
    let framesSince = 0.;
    
    let isReceivingMouseInput = false;

    const renderer = new THREE.WebGLRenderer();
    //renderer.shadowMap.enabled = true;

    renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight( 0xffffff, 1 );
    light.castShadow = true;

    const targetObject = new THREE.Object3D();

    light.target = targetObject;

    const ambientLight = new THREE.AmbientLight( 0x404040 );

    scene.add( light );
    scene.add ( light.target );
    scene.add( ambientLight );

    camera.position.z = 5;

    //let procMesh = new THREE.Mesh();
    const procGeometry = new THREE.BufferGeometry();
    let procMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    //procMaterial.side = THREE.DoubleSide;
    let procMesh = new THREE.Mesh( procGeometry, procMaterial );
    let pressure = 0;

   function Vertex(X, Y, Z, mass, initialVelocity, initialForce) {
       this.x = X;
       this.y = Y;
       this.z = Z;
       this.mass = mass;
       this.velocity = initialVelocity;
       this.force = initialForce;
       this.printInfo = function() {
           //console.log("Vertex:");
          // console.log("x: " + this.x);
           //console.log("y: " + this.y);
           //console.log("z: " + this.z);
           //console.log("vx: " + this.velocity.x);
           //console.log("vy: " + this.velocity.y);
           //console.log("velocity: " + this.velocity);
           //console.log("fx: " + this.force.x);
          // console.log("fy: " + this.force.y);
       }
       this.addForce = function(inForce) {
        this.force.add(inForce);
       };

       this.updateState = function() {
            const deltaTime = 1 / 60.;
            let acceleration = new THREE.Vector3(this.force.x, this.force.y, this.force.z);
            //let scalarForce = this.force.length();
            //acceleration = acceleration.multiply( this.mass);
            acceleration.x *= deltaTime / this.mass;
            acceleration.y *= deltaTime / this.mass;
            acceleration.z *= deltaTime / this.mass;
            //console.log(acceleration);
            this.velocity.add(acceleration);

            let deltaPosition = this.velocity.clone();

            this.x += deltaPosition.x * deltaTime;
            this.y += deltaPosition.y * deltaTime;
            this.z += deltaPosition.z * deltaTime;
       }
   }

   function Face(A, B, C) {
       this.A = A;
       this.B = B;
       this.C = C;
   }
   function Edge(A, B, initialOffset, springConstant) {
       this.A = A;
       this.B = B;
       this.initialOffset = initialOffset;
       this.springConstant = springConstant;
       /*
       this.getCompression = function() {
            let currentDistance = Math.sqrt((this.A.x - this.B.x)*(this.A.x - this.B.x) +
                (this.A.y - this.B.y)*(this.A.y - this.B.y) +
                (this.A.z - this.B.z)*(this.A.z - this.B.z));
            return initialOffset - currentDistance;
       };
       */
   }

    function SoftBody(verts, vertFaceIndex, edgeData) {
        this.verts = verts;
        this.vertFaceIndex = vertFaceIndex;
        this.edgeData = edgeData;
        this.generateEdgeData = function() {
            let currIndex = 0;
            for (var face in vertFaceIndex)
            {
                let currentFace = vertFaceIndex[face];
                let containsAB = false;
                let containsAC = false;
                let containsBC = false;
                for (var edgeCheck in edgeData)
                {
                    let checkingEdge = edgeData[edgeCheck];
                    if ((checkingEdge.A === currentFace.A && checkingEdge.B === currentFace.B) || (checkingEdge.A === currentFace.B && checkingEdge.B === currentFace.A))
                    {
                        containsAB = true;
                    }
                    if ((checkingEdge.A === currentFace.A && checkingEdge.C === currentFace.C) || (checkingEdge.A === currentFace.C && checkingEdge.C === currentFace.A))
                    {
                        containsAC = true;
                    }
                    if ((checkingEdge.C === currentFace.C && checkingEdge.B === currentFace.B) || (checkingEdge.B === currentFace.C && checkingEdge.C === currentFace.B))
                    {
                        containsBC = true;
                    }
                    if (containsAB && containsBC && containsAC)
                    {
                        break;
                    }
                }

                //Set For All
                const springConstant = 10.;

                if (!containsAB)
                {
                    edgeData[currIndex] = new Edge(currentFace.A, currentFace.B, 
                        Math.sqrt((verts[currentFace.A].x - verts[currentFace.B].x)*(verts[currentFace.A].x - verts[currentFace.B].x) + 
                        (verts[currentFace.A].y - verts[currentFace.B].y)*(verts[currentFace.A].y - verts[currentFace.B].y) + 
                        (verts[currentFace.A].z - verts[currentFace.B].z)*(verts[currentFace.A].z - verts[currentFace.B].z)), springConstant);
                    currIndex++;
                }
                if (!containsAC)
                {
                    edgeData[currIndex] = new Edge(currentFace.A, currentFace.C, 
                        Math.sqrt((verts[currentFace.A].x - verts[currentFace.C].x)*(verts[currentFace.A].x - verts[currentFace.C].x) + 
                        (verts[currentFace.A].y - verts[currentFace.C].y)*(verts[currentFace.A].y - verts[currentFace.C].y) + 
                        (verts[currentFace.A].z - verts[currentFace.C].z)*(verts[currentFace.A].z - verts[currentFace.C].z)), springConstant);
                        currIndex++;
                }
                if (!containsBC)
                {
                    edgeData[currIndex] = new Edge(currentFace.B, currentFace.C, 
                        Math.sqrt((verts[currentFace.B].x - verts[currentFace.C].x)*(verts[currentFace.B].x - verts[currentFace.C].x) + 
                        (verts[currentFace.B].y - verts[currentFace.C].y)*(verts[currentFace.B].y - verts[currentFace.C].y) + 
                        (verts[currentFace.B].z - verts[currentFace.C].z)*(verts[currentFace.B].z - verts[currentFace.C].z)), springConstant);
                        currIndex++;
                }
            }
            //console.log(edgeData);
        }
        this.convertToThreeMesh = function() {
            
                
            let positions = [];
            let currIndex = 0;
            for (var faceIndex in vertFaceIndex)
            {
                let face = vertFaceIndex[faceIndex];
                //console.log(face);
                
                positions[currIndex] = verts[face.A].x;
                currIndex++;
                positions[currIndex] = verts[face.A].y;
                currIndex++;
                positions[currIndex] = verts[face.A].z;
                currIndex++;
                positions[currIndex] = verts[face.B].x;
                currIndex++;
                positions[currIndex] = verts[face.B].y;
                currIndex++;
                positions[currIndex] = verts[face.B].z;
                currIndex++;
                positions[currIndex] = verts[face.C].x;
                currIndex++;
                positions[currIndex] = verts[face.C].y;
                currIndex++;
                positions[currIndex] = verts[face.C].z;
                currIndex++;
            }
        
            procGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
            procGeometry.computeVertexNormals();

            procGeometry.needsUpdate = true;
            
        };
        this.setAllForces = function() {        
            for (var vert in verts)
            {
                let currVert = verts[vert];
                currVert.force.x = 0.;
                currVert.force.y = currVert.mass * -.1;
                currVert.force.z = 0.;
            }
            this.HandleCollision();

           this.updateSpringForces();

           this.addPressureForce();

            this.updateVertexStates();
            
            let currIndex = 0;
            let dataToPrint = [];
        }
        this.HandleCollision = function() {
            for (var vert in verts)
            {
                let currVert = verts[vert];
                if (currVert.y < 0)
                {
                    currVert.y = 0;
                    currVert.velocity.reflect(new THREE.Vector3(0., 1., 0.));
                    currVert.velocity.x *= .8;
                    currVert.velocity.y *= .8;
                    currVert.velocity.z *= .8;
                }
            }
        };
        this.updateSpringForces = function() {
            for (var edge in edgeData)
            {
                let currEdge = edgeData[edge];
                let vertA = verts[currEdge.A];
                let vertB = verts[currEdge.B];
                let compression = this.calculateEdgeCompression(currEdge);
                let forceNormal = new THREE.Vector3(vertA.x - vertB.x, vertA.y - vertB.y, vertA.z - vertB.z);
                forceNormal.clampLength(compression * currEdge.springConstant, compression * currEdge.springConstant);
                vertA.addForce(forceNormal);
                forceNormal.x *= -1.;
                forceNormal.y *= -1.;
                forceNormal.z *= -1.;
                vertB.addForce(forceNormal); 
            }
        };
        this.updateVertexStates = function() {
            for (var vert in verts)
            {
                let currVert = verts[vert];
                currVert.updateState();
            }
        };
        this.calculateEdgeCompression = function(inEdge) {
            let vertA = verts[inEdge.A];
            let vertB = verts[inEdge.B];
            return inEdge.initialOffset - Math.sqrt((vertA.x - vertB.x) * (vertA.x - vertB.x) +
                (vertA.y - vertB.y) * (vertA.y - vertB.y) +
                (vertA.z - vertB.z) * (vertA.z - vertB.z));
        };

        this.addPressureForce = function() {
            let volume = getVolume(procGeometry);
            let pressure = .00005 * nRT / volume;

            for (var face in vertFaceIndex)
            {
                let currFace = vertFaceIndex[face];

                let vertexA = new THREE.Vector3(verts[currFace.A].x, verts[currFace.A].y, verts[currFace.A].z);
                let vertexB = new THREE.Vector3(verts[currFace.B].x, verts[currFace.B].y, verts[currFace.B].z);
                let vertexC = new THREE.Vector3(verts[currFace.C].x, verts[currFace.C].y, verts[currFace.C].z);

                let vec1 = new THREE.Vector3(vertexB.x - vertexA.x, vertexB.y - vertexA.y, vertexB.z - vertexA.z);
                let vec2 = new THREE.Vector3(vertexC.x - vertexA.x, vertexC.y - vertexA.y, vertexC.z - vertexA.z);

                let area = vec1.cross(vec2).length() * .5;
                
                //vec1.x *= 1 / (area * area);
                //vec1.y *= 1 / (area * area);
                //vec1.z *= 1 / (area * area);

                vec1.x *= pressure / 3.;
                vec1.y *= pressure / 3.;
                vec1.z *= pressure / 3.;

                verts[currFace.A].addForce(vec1);
                verts[currFace.B].addForce(vec1);
                verts[currFace.C].addForce(vec1);
            }
        }
    }

    const sphereGeom = new THREE.TorusGeometry(2, 1, 32, 32);
    const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
    const sphere =  new THREE.Mesh( sphereGeom, material );
    
    console.log(sphereGeom);

    let sphereVertices = sphereGeom.getAttribute('position');
    let sphereFaces = sphereGeom.index;

    let arrayLength = sphereVertices.count;

    let readingArray = sphereVertices.array;
    console.log(readingArray[2]);
    let vertArray = [];
    for (var i = 0; i < arrayLength; i++)
    {
        let baseIndex = i * 3;

        

        vertArray[i] = new Vertex(readingArray[parseInt(baseIndex)], readingArray[baseIndex + 1] + 5., readingArray[baseIndex + 2], 10., new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.));
        
        //currIndex++;

        //console.log(sphereVertices[parseInt(baseIndex)]);

    }

    readingArray = sphereFaces.array;
    let faceArray = [];
    for (var i = 0; i < sphereFaces.count / 3; i++)
    {
        let baseIndex = i * 3;
        faceArray[i] = new Face(readingArray[baseIndex], readingArray[baseIndex + 1], readingArray[baseIndex + 2]);

        if (readingArray[baseIndex] > 560 || readingArray[baseIndex + 1] > 560 || readingArray[baseIndex] > 560)
        {
            console.log("OUT OF BOUNDS");
        }
        else
        {
            console.log("NOT OUT OF BOUNDS");
        }

    }

    console.log(vertArray);
    console.log(faceArray);

    //Set for all

    const pointMass = 10.;
    
    let Body = new SoftBody(
        [
            new Vertex(0., 3, 0., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)), 
            new Vertex(0., 4, 0., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)), 
            new Vertex(0., 4, 1., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)),
            new Vertex(0., 3, 1., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)),

            
            new Vertex(-1., 4, 0., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)), 
            new Vertex(-1., 3, 0., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)),
            new Vertex(-1., 4, 1., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.)),
            new Vertex(-1., 3, 1., pointMass, new THREE.Vector3(0., 0., 0.), new THREE.Vector3(0., 0., 0.))
            
        ], 
        [
            new Face(0, 1, 2), 
            new Face(0, 2, 3),
            new Face(0, 4, 1),
            new Face(0, 5, 4),
            new Face(4, 5, 6),
            new Face(5, 7, 6),
            new Face(3, 6, 7),
            new Face(3, 2, 6),
            new Face(1, 4, 2),
            new Face(2, 4, 6),
            new Face(0, 3, 5),
            new Face(3, 7, 5) 
        ], 
        [
        ]);
        
    //

    //let Body = new SoftBody(vertArray, faceArray, []);
    Body.generateEdgeData();
    Body.convertToThreeMesh();
    
    scene.add(procMesh);

    Body.setAllForces();

        /*
    let vertexA = new THREE.Vector3(0., .5, 0.);
    let vertexB = new THREE.Vector3(-1, 1.5, 0);
    let vertexC = new THREE.Vector3(0., 1.5, 0);

    let vec1 = new THREE.Vector3(vertexB.x - vertexA.x, vertexB.y - vertexA.y, vertexB.z - vertexA.z);
    let vec2 = new THREE.Vector3(vertexC.x - vertexA.x, vertexC.y - vertexA.y, vertexC.z - vertexA.z);

    vec1.cross(vec2);

    vec1.add(vertexA);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const points = [];
    points.push( vertexA );
    points.push( vec1 );

    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);

    const line = new THREE.Line( lineGeom, lineMaterial );
    scene.add( line );
    */

    document.addEventListener('mousemove', onDocumentMouseMove, false);

    function onDocumentMouseMove(event) {
        event.preventDefault();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    document.addEventListener('mousedown', onMouseClick, false);
    document.addEventListener('mouseup', onMouseRelease, false);

    function onMouseClick(event) {
        event.preventDefault();
        isReceivingMouseInput = true;
    }

    function onMouseRelease(event) {
        event.preventDefault();
        isReceivingMouseInput = false;
    }


    //scene.add( procMesh );

    const groundGeometry = new THREE.BoxGeometry(10., 1., 10.);
    const groundMaterial = new THREE.MeshLambertMaterial( {color: 0xffff00 } );
    const cube = new THREE.Mesh(groundGeometry, groundMaterial);

    cube.position.y = -.5;

    scene.add( cube );

    function animate() {

        renderer.renderLists.dispose();

        requestAnimationFrame( animate );
        renderer.render( scene, camera );
        
        //if (wireFrame)
        //{
        //    wireFrame.remove();
        //}
        Body.setAllForces();
        
        //procMesh.dispose();
        //procMesh.remove();

        Body.convertToThreeMesh();

        //scene.add(procMesh);

        //const wireFrameGeometry = new THREE.WireframeGeometry( procMesh.geometry );
        //wireFrame = new THREE.LineSegments( wireFrameGeometry);
        //wireFrame.material.depthTest = false;
        //wireFrame.material.opacity = .25;
        //wireFrame.material.transparent = true;

        //scene.add(wireFrame);

        
        
        if ( isReceivingMouseInput )
        {
            theta +=( mouse.x - previousMouse.x ) * rotationSpeed;
        }

        //console.log(getVolume(procGeometry));

        camera.position.x = Math.cos(theta) * cameraLength;
        camera.position.z = Math.sin(theta) * cameraLength;
        camera.position.y = cameraLength;

        camera.lookAt( new THREE.Vector3(0, 0, 0));

        targetObject.position.x = 10.;
        targetObject.position.z = 10.;
        targetObject.position.y = -10.;

        previousMouse.x = mouse.x;
        previousMouse.y = mouse.y;

        framesSince += 1.;
    }

    animate();
}
