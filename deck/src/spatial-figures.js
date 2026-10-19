import * as THREE from '../vendor/three/build/three.module.js?v=a172b369e672e17d83cb';

// Quiet scale figures, rather than detailed characters. Two instanced meshes
// share all geometry and material; the caller supplies the active motion clock.
export function createSpatialFigures(option) {
  const group = new THREE.Group();
  group.name = 'spatial-scale-figures';
  if (option !== 'shelf' && option !== 'wall') {
    return { group, update() {}, dispose() { group.clear(); } };
  }

  const people = option === 'shelf'
    ? [
        { from: [-8.16, .65], to: [-8.16, 7.55], height: 1.73, leg: 22, offset: 3, color: '#80857f' },
        { position: [-10.2, 4.7], heading: Math.PI / 2, height: 1.68, color: '#9b9d92' }
      ]
    : [
        { from: [-23.4, 14.05], to: [-20.3, 14.05], height: 1.75, leg: 17, offset: 5, color: '#80857f' },
        { position: [-10.3, 13.25], heading: 0, height: 1.69, color: '#9b9d92' }
      ];
  const spheresPerPerson = 5; // head, torso, pelvis, and two shoes
  const cylindersPerPerson = 9; // neck, two articulated arms, and two legs
  const sphereGeometry = new THREE.SphereGeometry(1, 10, 8);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .95, metalness: 0 });
  const spheres = new THREE.InstancedMesh(sphereGeometry, material, people.length * spheresPerPerson);
  const cylinders = new THREE.InstancedMesh(cylinderGeometry, material, people.length * cylindersPerPerson);
  spheres.name = 'spatial-figure-volumes';
  cylinders.name = 'spatial-figure-limbs';
  for (const mesh of [spheres, cylinders]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The only moving geometry stays within the existing architectural floor.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  people.forEach((person, personIndex) => {
    const color = new THREE.Color(person.color);
    for (let i = 0; i < spheresPerPerson; i++) spheres.setColorAt(personIndex * spheresPerPerson + i, color);
    for (let i = 0; i < cylindersPerPerson; i++) cylinders.setColorAt(personIndex * cylindersPerPerson + i, color);
  });

  const matrix = new THREE.Matrix4();
  const root = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const identity = new THREE.Quaternion();
  let disposed = false;
  let sphereIndex = 0;
  let cylinderIndex = 0;

  function volume(x, y, z, width, height, depth) {
    position.set(x, y, z);
    scale.set(width, height, depth);
    matrix.compose(position, identity, scale).premultiply(root);
    spheres.setMatrixAt(sphereIndex++, matrix);
  }

  function limb(a, b, radius) {
    start.set(...a);
    end.set(...b);
    direction.subVectors(end, start);
    const length = direction.length();
    position.copy(start).add(end).multiplyScalar(.5);
    rotation.setFromUnitVectors(up, direction.divideScalar(length));
    scale.set(radius, length, radius);
    matrix.compose(position, rotation, scale).premultiply(root);
    cylinders.setMatrixAt(cylinderIndex++, matrix);
  }

  function pathPose(person, seconds) {
    if (person.position) return { x: person.position[0], z: person.position[1], heading: person.heading + Math.sin(seconds * .17) * .075, speed: 0 };
    const turn = 2.5;
    const leg = person.leg;
    const cycle = 2 * (leg + turn);
    const time = (seconds + person.offset) % cycle;
    const initialHeading = Math.atan2(person.to[0] - person.from[0], person.to[1] - person.from[1]);
    let progress, heading, speed;
    const ease = t => .5 - .5 * Math.cos(t * Math.PI);
    if (time < leg) {
      const phase = time / leg;
      progress = ease(phase);
      heading = initialHeading;
      speed = Math.sin(phase * Math.PI);
    } else if (time < leg + turn) {
      progress = 1;
      heading = initialHeading + Math.PI * ease((time - leg) / turn);
      speed = 0;
    } else if (time < 2 * leg + turn) {
      const phase = (time - leg - turn) / leg;
      progress = 1 - ease(phase);
      heading = initialHeading + Math.PI;
      speed = Math.sin(phase * Math.PI);
    } else {
      progress = 0;
      heading = initialHeading + Math.PI + Math.PI * ease((time - 2 * leg - turn) / turn);
      speed = 0;
    }
    return {
      x: THREE.MathUtils.lerp(person.from[0], person.to[0], progress),
      z: THREE.MathUtils.lerp(person.from[1], person.to[1], progress),
      heading,
      speed
    };
  }

  function update(seconds = 0) {
    if (disposed) return;
    const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    sphereIndex = 0;
    cylinderIndex = 0;
    people.forEach((person, index) => {
      const pose = pathPose(person, time);
      const figureScale = person.height / 1.725;
      position.set(pose.x, .018, pose.z);
      rotation.setFromAxisAngle(up, pose.heading);
      scale.setScalar(figureScale);
      root.compose(position, rotation, scale);
      const gait = Math.sin(time * 3.1 + index * 1.7) * .105 * pose.speed;
      const lift = Math.abs(gait) * .075;
      // Rounded, featureless silhouettes keep attention on the models.
      volume(0, 1.6 + lift, 0, .095, .125, .095);
      volume(0, 1.205 + lift, 0, .17, .255, .095);
      volume(0, .945 + lift, 0, .13, .12, .09);
      limb([0, 1.405 + lift, 0], [0, 1.5 + lift, 0], .052);
      for (const side of [-1, 1]) {
        const stride = gait * side;
        const hip = [side * .075, .935 + lift, 0];
        const knee = [side * .082, .51, stride * .62 + .015];
        const foot = [side * .085, .065 + Math.max(0, stride) * .13, stride];
        limb(hip, knee, .057);
        limb(knee, foot, .041);
        volume(foot[0], foot[1] - .025, foot[2] + .025, .05, .037, .095);
        const shoulder = [side * .165, 1.365 + lift, 0];
        const elbow = [side * .2, 1.115 + lift, -.018 - stride * .52];
        const hand = [side * .185, .87 + lift, .025 - stride * .88];
        limb(shoulder, elbow, .037);
        limb(elbow, hand, .029);
      }
    });
    spheres.instanceMatrix.needsUpdate = true;
    cylinders.instanceMatrix.needsUpdate = true;
  }

  update(0);
  spheres.computeBoundingBox();
  cylinders.computeBoundingBox();

  function dispose() {
    if (disposed) return;
    disposed = true;
    spheres.dispose();
    cylinders.dispose();
    sphereGeometry.dispose();
    cylinderGeometry.dispose();
    material.dispose();
    group.clear();
  }

  return { group, update, dispose };
}
