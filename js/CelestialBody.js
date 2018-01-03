// Celestial body constructor
var CelestialBody = function (obj) {
    // Meta
    this.name = "";
    // If the planet is the sun
    this.star = false;
    // Object shape info
    this.spherical = true; this.oblateness = 0.; this.radius = 1.;
    // Parent/moon objects
    this.parent = null;
    this.children = [];
    // TODO: Model info, to be implemented
    // Orbit parameters
    // 周期（恒星）、半长轴、离心率、倾角、升交点黄经、平近点角 (历时原点假设轨道是圆形时的黄经偏移)
    this.orbit = {
        period: 1., semiMajorAxis: 1., eccentricity: 0.,
        inclination: 0., ascendingNode: 0., meanLongitude: 0.
    };
    // Rotation parameters
    // 周期（恒星）、倾角（黄赤夹角）、子午角（自转轴所在的与黄道垂直的平面，即子午面，与xOy平面的夹角）、历时原点角度偏移
    // 注：这里我们使用xOz平面作为黄道面
    this.rotation = {
        period: 1., inclination: 1.,
        meridianAngle: 0., offset: 0.
    };
    // 远景时显示光芒的参数设定
    // albedo 为反照率
    // 下面给出一个该把这个光点画多亮的粗略估计（只是用来看的，不是很严谨）
    // x > R/k:   (2 - <c, p>/(|c|*|p|)) * R^2 * a * log(k*x0/R) / log(k*x/R)
    // else:    0
    // 其中，a是反照率，记号<,>表示内积，|.|是二范数，c是摄像机坐标，p是天体坐标
    // R 是天体半径，x 是距天体的距离，即|c - p|，k 是一个系数
    this.albedo = 1.;
    this.shineColor = 0xffffff;
    // Material settings
    this.material = {
        // "phong", "lambert", "basic"
        type: "phong",
        diffuse: { map: null, color: 0xffffff },
        specular: { map: null, color: 0xffffff, shininess: 25 },
        night: { map: null },
        bump: { map: null, height: 10 }
    };
    // Planet ring definitions
    this.ring = {
        map: null,
        lower: 2000, higher: 6000,
        color: 0xffffff, specularColor: 0xffffff, specularPower: 5
    };
    // Holo effect
    this.holo = {
        // TODO: Other parameters to be implemented
        color: 0x000000
    };
    // TODO: Atmosphere parameters to be implemented
    this.atmosphere = {
        cloud: {
            map: null, height: 1, speed: 20
        }
    };

    mergeRecursive(this, obj);
};

function mergeRecursive(obj1, obj2) {
    for (var p in obj2) {
        try {
            //Property in destination object set; update its value.
            if (obj2[p].constructor == Object) {
                obj1[p] = mergeRecursive(obj1[p], obj2[p]);
            } else {
                obj1[p] = obj2[p];
            }
        } catch (e) {
            //Property in destination object not set; create it and set its value.
            obj1[p] = obj2[p];
        }
    }
    return obj1;
}

// lens flare texture
CelestialBody.prototype.flareTexture = textureLoader.load("res/effects/flare.jpg");

// IMPORTANT: This function of the prototype generate the object and put it on
// the scene. This is the most most important part in drawing the object.
CelestialBody.prototype.generateObjectsOnScene = function (argScene) {
    var that = this;
    // if(this.spherical)
    this.bodySphereGeometry = new THREE.SphereGeometry(this.radius, 64, 64);
    // TODO: Add .obj model file here
    // else if(!this.spherical) blablabla...
    // The base body sphere material
    var sphereMaterial = this.bodySphereMaterial = null;
    switch (this.material.type) {
        case "basic":
            sphereMaterial = this.bodySphereMaterial
                = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(this.material.diffuse.color)});
            if(this.material.diffuse.map !== null) {
                sphereMaterial.map = textureLoader.load(this.material.diffuse.map);
            }
            break;
        case "lambert":
            sphereMaterial = this.bodySphereMaterial
                = new THREE.MeshLambertMaterial({
                    color: new THREE.Color(this.material.diffuse.color),
                    bumpScale: this.material.bump.height});
            if(this.material.diffuse.map !== null) {
                sphereMaterial.map = textureLoader.load(this.material.diffuse.map);
            }
            break;
        case "phong": default:
            sphereMaterial = this.bodySphereMaterial
                = new THREE.MeshPhongMaterial({
                    color: new THREE.Color(this.material.diffuse.color),
                    specular: new THREE.Color(this.material.specular.color),
                    shininess: this.material.specular.shininess,
                    bumpScale: this.material.bump.height});
            if(this.material.diffuse.map !== null) {
                sphereMaterial.map = textureLoader.load(this.material.diffuse.map);
            }
            if(this.material.specular.map !== null) {
                sphereMaterial.specularMap = textureLoader.load(this.material.specular.map);
            }
            if(this.material.bump.map !== null) {
                sphereMaterial.bumpMap = textureLoader.load(this.material.bump.map);
            }
            break;
    }
    this.objectGroup = new THREE.Group();
    // Add the main body part
    textureLoader.load(this.material.diffuse.map, function (texture) {
        this.bodySphereMaterial = new THREE.MeshPhongMaterial({map:texture});
    });
    this.bodySphereMesh = new THREE.Mesh(this.bodySphereGeometry, this.bodySphereMaterial);
    this.bodySphereMesh.scale.set(1, 1 - this.oblateness, 1);
    
    // Add lens flare
    this.lensFlare = null;
    if(!this.star) {
        this.lensFlare =
            new THREE.LensFlare(this.flareTexture, 20*Math.log(this.radius)*this.albedo,
                0, THREE.AdditiveBlending, new THREE.Color(this.shineColor));
        this.lensFlare.size = 200;
        this.lensFlare.position.set(this.getX(), this.getY(), this.getZ());

        var that = this;      
        this.lensFlare.customUpdateCallback = function() {
            let cameraDistance = Math.sqrt(
                (cameraParameters.getX() - that.getX())
                * (cameraParameters.getX() - that.getX()),
                (cameraParameters.getY() - that.getY())
                * (cameraParameters.getY() - that.getY()),
                (cameraParameters.getZ() - that.getZ())
                * (cameraParameters.getZ() - that.getZ()));
            if(cameraDistance/that.radius < 125) {
                that.bodySphereMaterial.depthTest = true;
            }
            else {
                that.bodySphereMaterial.depthTest = false;
            }
            this.updateLensFlares();
        };
    } else {
        this.lensFlare =
        new THREE.LensFlare(this.flareTexture, 400, 0, 
            THREE.AdditiveBlending, new THREE.Color(this.shineColor));
    }

    // Add clouds
    this.cloudGeometry = null;
    this.cloudMaterial = null;
    this.cloudMesh = null;
    if(this.atmosphere.cloud.map !== null) {
        this.cloudGeometry = new THREE.SphereGeometry(this.radius + this.atmosphere.cloud.height, 64, 64);
        if(!this.star) {
            this.cloudMaterial = new THREE.MeshLambertMaterial({
                map: textureLoader.load(this.atmosphere.cloud.map),
                transparent: true});
        } else {
            this.cloudMaterial = new THREE.MeshBasicMaterial({
                map: textureLoader.load(this.atmosphere.cloud.map),
                transparent: true});
        }
        this.cloudMesh = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
    }

    // Add meshes to the object group
    this.objectGroup.add(this.lensFlare);
    this.objectGroup.add(this.bodySphereMesh);
    // if(!this.star) this.bodySphereMesh.castShadow = true;
    // if(!this.star) this.bodySphereMesh.receiveShadow = true;
    if(this.cloudMesh !== null) { 
        this.objectGroup.add(this.cloudMesh);
        // if(!this.star) this.cloudMesh.castShadow = true;
        // if(!this.star) this.cloudMesh.receiveShadow = true;
    }
    argScene.add(this.objectGroup);
};

CelestialBody.prototype.updateOrbitAndRotation = function(time) {
    // Calculate the orbit
    // The reference frame (X, Y, Z) is the center coordinate of
    // the object's parent body.
    let referenceFrameX = 0;
    let referenceFrameY = 0;
    let referenceFrameZ = 0;
    if(this.parent != null) {
        referenceFrameX = this.parent.getX();
        referenceFrameY = this.parent.getY();
        referenceFrameZ = this.parent.getZ();
    }
    // Now this is only a naive way of calculating the orbit
    // Note that zOx is the orbit plane
    // x -> z   y -> z  z -> x
    let x = referenceFrameX + this.orbit.semiMajorAxis * Math.sin(time);
    let y = referenceFrameY;
    let z = referenceFrameZ + this.orbit.semiMajorAxis * Math.cos(time);
    
    this.objectGroup.position.set(x, y, z);
} 

CelestialBody.prototype.updateClouds = function (time) {
    if(this.cloudGeometry !== null) {
        this.cloudGeometry.rotateY(time*this.atmosphere.cloud.speed/360);
    }
}

CelestialBody.prototype.update = function (time) {
    if(this.objectGroup !== undefined) {
        this.updateOrbitAndRotation(time);
        this.updateClouds(time);
    }
};

CelestialBody.prototype.getX = function () {
    if (this.objectGroup == null || this.objectGroup.position == null) return 0;
    return this.objectGroup.position.getComponent(0);
};

CelestialBody.prototype.getY = function () {
    if (this.objectGroup == null || this.objectGroup.position == null) return 0;
    return this.objectGroup.position.getComponent(1);
};

CelestialBody.prototype.getZ = function () {
    if (this.objectGroup == null || this.objectGroup.position == null) return 0;
    return this.objectGroup.position.getComponent(2);
};