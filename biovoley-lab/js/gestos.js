/* BioVoley Lab — fundamentos técnicos y criterios de evaluación por cámara.
   Una sola fuente de verdad: la sección Fundamentos muestra los puntos clave y la
   cámara usa los mismos gestos para evaluar la postura en vivo.
   Puntos clave basados en Cortina (2007) "Voleibol: fundamentos técnicos" (UNAM);
   criterios de aterrizaje basados en Hewett et al. (2005) y en el LESS. */
(function (BV) {
  'use strict';
  /** banda: ok dentro de [a,b], aviso dentro de [c,d], si no, crítico */
  const band = (a, b, c, d) => (v) => (v >= a && v <= b ? 'ok' : v >= c && v <= d ? 'warn' : 'crit');
  const atLeast = (ok, warn) => (v) => (v >= ok ? 'ok' : v >= warn ? 'warn' : 'crit');
  const atMost = (ok, warn) => (v) => (v <= ok ? 'ok' : v <= warn ? 'warn' : 'crit');
  const count2 = (v) => (v >= 2 ? 'ok' : v === 1 ? 'warn' : 'crit');
  const bool = (v) => (v ? 'ok' : 'crit');
  const deg = (v) => Math.round(v) + '°';
  const x2 = (v) => v.toFixed(2) + '×';

  const LEGS = [23, 24, 25, 26, 27, 28];
  const ARMS = [11, 12, 13, 14, 15, 16];

  // ----- bloques reutilizables -----
  const K = {
    rodillas: (ok, warn, cues) => ({
      id: 'knee', label: 'Knee flexion', get: (m) => m.kneeFlex, fmt: deg, vis: LEGS, joints: [25, 26],
      ideal: `${ok[0]}–${ok[1]}°`, eval: band(ok[0], ok[1], warn[0], warn[1]), cue: cues,
    }),
    tronco: (ok, warn, cues) => ({
      id: 'trunk', label: 'Trunk lean', get: (m) => m.trunk, fmt: deg, vis: [11, 12, 23, 24], joints: [11, 12, 23, 24],
      ideal: `${ok[0]}–${ok[1]}°`, eval: band(ok[0], ok[1], warn[0], warn[1]), cue: cues,
    }),
    base: (ok, warn, cues) => ({
      id: 'stance', label: 'Foot width', need: 'frontal', get: (m) => m.stance, fmt: x2, vis: [11, 12, 27, 28], joints: [27, 28],
      ideal: `${ok[0]}–${ok[1]} × shoulder width`, eval: band(ok[0], ok[1], warn[0], warn[1]), cue: cues,
    }),
    simetriaBrazos: {
      id: 'armsym', label: 'Arm symmetry', get: (m) => m.elbowAsym, fmt: deg, vis: ARMS, joints: [13, 14],
      ideal: 'difference < 12°', eval: atMost(12, 25),
      cue: { ok: 'Both arms work evenly.', warn: 'One arm is bent more than the other.', crit: 'Arms very uneven: the ball will go off line.' },
    },
  };

  const GESTOS = [
    {
      id: 'espera', nombre: 'Ready position', corto: 'Stance',
      resumen: 'The waiting stance every movement starts from. It has three heights: high, medium and low.',
      fases: ['High', 'Medium', 'Low'], vista: 'Front and side',
      puntos: [
        'Head up, eyes forward.',
        'Knees slightly bent, one foot a little ahead, toes forward.',
        'Weight on the balls of the feet, ready to react.',
        'Arms slightly bent, in front or at the sides.',
        'Medium: most used for passing and setting. Low: for court defense.',
      ],
      prevencion: 'Bent legs lower the center of mass and allow stopping and changing direction without loading a straight knee.',
      checks: [
        K.rodillas([25, 80], [15, 100], { ok: 'Knees ready to react.', warn: 'Adjust the bend: not too straight, not too low.', crit: 'Legs almost straight: bend them to react faster.' }),
        K.tronco([5, 35], [0, 50], { ok: 'Trunk well placed.', warn: 'Check your trunk lean.', crit: 'Trunk leaning too far: you lose balance and vision.' }),
        K.base([1.0, 1.8], [0.8, 2.2], { ok: 'Stable base.', warn: 'Open or close your feet a little: shoulder width or slightly more.', crit: 'Feet too close or too wide: unstable base.' }),
        { id: 'arms', label: 'Arms forward, slightly bent', get: (m) => m.elbowMean, fmt: deg, vis: ARMS, joints: [13, 14], ideal: '90–165°', eval: band(90, 165, 70, 178),
          cue: { ok: 'Arms ready.', warn: 'Relax your arms forward.', crit: 'Arms stiff or pinned to the body.' } },
      ],
    },
    {
      id: 'antebrazos', nombre: 'Forearm pass / serve reception', corto: 'Forearm pass',
      resumen: 'Forearm contact to receive a serve or defend. Forms a flat, firm platform.',
      fases: ['Ready', 'Contact (leg extension)', 'Finish'], vista: 'Front for feet and arms; side for legs and trunk',
      puntos: [
        'Staggered feet, weight on the balls of the feet, legs bent.',
        'Trunk slightly forward, arms away from the body.',
        'At contact: hands joined and arms straight, forming a flat, firm surface.',
        'Power comes from a gradual leg extension and moving the shoulders forward and up, not from swinging the arms.',
        'Do not drop your arms while waiting for the ball. Receiving in zone 1, right leg forward; in zone 5, left leg.',
      ],
      prevencion: 'Passing with the legs (not the back) shares the load between hips and knees and protects the lower back.',
      checks: [
        K.rodillas([30, 80], [20, 100], { ok: 'Good flexion for passing.', warn: 'Adjust your leg bend a little.', crit: 'Legs almost straight: get low with your legs, not your back.' }),
        K.tronco([15, 45], [5, 60], { ok: 'Trunk leaning forward.', warn: 'Lean your trunk forward, weight on your toes.', crit: 'Trunk too upright or too bent.' }),
        { id: 'elbow', label: 'Arms straight (platform)', get: (m) => m.elbowMin, fmt: deg, vis: ARMS, joints: [13, 14], ideal: '≥ 160°', eval: atLeast(160, 140),
          cue: { ok: 'Firm, straight platform.', warn: 'Straighten your elbows a little more.', crit: 'Elbows bent: join your hands and straighten your arms.' } },
        { id: 'platform', label: 'Platform height', get: (m) => m.shElevMean, fmt: deg, vis: ARMS.concat([23, 24]), joints: [11, 12], ideal: '20–80° from the trunk', eval: band(20, 80, 10, 100),
          cue: { ok: 'Arms between waist and knees.', warn: 'Move your arms away from the body without raising them too much.', crit: 'Arms above the shoulder: the ball will go backward.' } },
        K.base([1.0, 1.9], [0.8, 2.3], { ok: 'Wide, stable base.', warn: 'Set your feet shoulder width or slightly wider.', crit: 'Feet too close: unstable base.' }),
        K.simetriaBrazos,
      ],
    },
    {
      id: 'voleo', nombre: 'Overhead pass / set', corto: 'Set',
      resumen: 'Pass with the fingers above the head; the setter\'s skill to prepare the attack.',
      fases: ['Getting under the ball', 'Loading bend', 'Extension and contact', 'Finish'], vista: 'Front or side',
      puntos: [
        'Face the target and get under the ball.',
        'Staggered feet, legs slightly bent, trunk slightly forward.',
        'Arms bent, cupped hands, fingers in front of the face at eye level.',
        'Contact with all fingertips, extending arms and legs together.',
        'At the end, the hands point to the target and the body is extended.',
      ],
      prevencion: 'Using the legs in the extension reduces the load on wrists and fingers.',
      checks: [
        { id: 'hands', label: 'Hands at forehead height', get: (m) => m.wristsAboveEyes, fmt: (v) => `${v}/2`, vis: [0, 15, 16], joints: [15, 16], ideal: 'both hands', eval: count2,
          cue: { ok: 'Cupped hands above the forehead.', warn: 'Raise the other hand to forehead height.', crit: 'Bring your hands up, in front of your face.' } },
        { id: 'elbow', label: 'Elbows bent', get: (m) => m.elbowMean, fmt: deg, vis: ARMS, joints: [13, 14], ideal: '60–150°', eval: band(60, 150, 45, 170),
          cue: { ok: 'Arms ready to absorb and push.', warn: 'Receive with more elbow bend and extend at the end.', crit: 'Arms straight or closed: you cannot control the force.' } },
        { id: 'shelev', label: 'Elbows up (open)', get: (m) => m.shElevMean, fmt: deg, vis: ARMS.concat([23, 24]), joints: [11, 12], ideal: '90–170°', eval: band(90, 170, 70, 180),
          cue: { ok: 'Elbows open at the right height.', warn: 'Raise your elbows a little.', crit: 'Low elbows: the ball will stay in front of the chest.' } },
        K.rodillas([10, 50], [5, 70], { ok: 'Legs slightly bent.', warn: 'Adjust your leg bend.', crit: 'Use your legs: bend and extend with the pass.' }),
        K.tronco([0, 20], [0, 30], { ok: 'Stable trunk.', warn: 'Straighten your trunk a little.', crit: 'Trunk leaning too far: get under the ball.' }),
        K.simetriaBrazos,
      ],
    },
    {
      id: 'saque', nombre: 'Overhand serve (topspin or float)', corto: 'Serve',
      resumen: 'Puts the ball in play. Topspin follows a clear parabola; the float has an irregular path.',
      fases: ['Toss', 'Arm cock', 'Hit', 'Move into court'], vista: 'Front (feet) or side (arm)',
      puntos: [
        'Toss the ball as accurately as possible.',
        'The front leg is opposite the hitting arm.',
        'In overhand serves, weight rests on the back leg before contact.',
        'Hit with a straight arm; in the float, a sharp hit that stops at contact.',
      ],
      prevencion: 'Cocking with a high elbow and rotating the trunk shares the shoulder load; a low elbow concentrates stress on the rotator cuff.',
      shot: true,
      checks: [
        { id: 'hitsh', label: 'High elbow when cocking', get: (m) => m.hitShElev, fmt: deg, vis: [11, 12, 13, 14, 23, 24], hit: true, ideal: '≥ 100° from the trunk', eval: atLeast(100, 80),
          cue: { ok: 'Elbow above the shoulder.', warn: 'Raise your elbow a little more.', crit: 'Low elbow: bring the arm up like a bow before hitting.' } },
        { id: 'hitel', label: 'Straight arm at contact', get: (m) => m.hitElbow, fmt: deg, vis: ARMS, hit: true, ideal: '≥ 150° with the hand high', eval: atLeast(150, 120), only: (m) => m.hitWristAbove,
          cue: { ok: 'Contact at the highest point.', warn: 'Straighten your arm more when hitting.', crit: 'Hitting with a bent arm: you lose height and power.' } },
        { id: 'foot', label: 'Front foot opposite the arm', need: 'frontal', get: (m) => m.footOk, fmt: (v) => (v ? 'Yes' : 'No'), vis: [27, 28], joints: [27, 28], ideal: 'opposite foot forward', eval: bool,
          cue: { ok: 'Correct base to transfer weight.', warn: '', crit: 'Step forward with the leg opposite your hitting arm.' } },
        K.tronco([0, 25], [0, 35], { ok: 'Stable trunk.', warn: 'Control your trunk lean.', crit: 'Trunk leaning too far: you lose control of the toss.' }),
      ],
    },
    {
      id: 'remate', nombre: 'Spike', corto: 'Spike',
      resumen: 'The main attack (third touch). Depends on the approach, the jump and contact at the highest point.',
      fases: ['Approach', 'Takeoff', 'Hit', 'Landing'], vista: 'Side for the arm; front for the landing',
      puntos: [
        'The last step of the approach is the longest and lowest; brake with the heel.',
        'Feet shoulder width at takeoff; jump off both feet with arms swinging back, forward and up.',
        'Hitting arm bent beside the head with the elbow up; the other arm in front at face height for balance.',
        'Hit with a straight arm at the highest point, with a wrist snap.',
        'Soft landing on both feet.',
      ],
      prevencion: 'Volleyball has the highest rate of jumper\'s knee (≈ 45%, Lian et al., 2005): a soft two-foot landing is part of the technique, not an extra.',
      shot: true, jump: true,
      checks: [
        { id: 'hitsh', label: 'High elbow (cocking)', get: (m) => m.hitShElev, fmt: deg, vis: [11, 12, 13, 14, 23, 24], hit: true, ideal: '≥ 110°', eval: atLeast(110, 90),
          cue: { ok: 'Elbow up, bow position.', warn: 'Raise your elbow above the shoulder.', crit: 'Low elbow: risk to the shoulder and a lower contact.' } },
        { id: 'hitel', label: 'Straight arm at contact', get: (m) => m.hitElbow, fmt: deg, vis: ARMS, hit: true, ideal: '≥ 150° with the hand high', eval: atLeast(150, 120), only: (m) => m.hitWristAbove,
          cue: { ok: 'Contact at the highest point.', warn: 'Straighten your arm more at contact.', crit: 'Hitting with a bent arm: you lose height.' } },
        { id: 'off', label: 'Opposite arm up', get: (m) => m.offWristUp, fmt: (v) => (v ? 'Yes' : 'No'), vis: ARMS, ideal: 'in front, at face height', eval: (v) => (v ? 'ok' : 'warn'),
          cue: { ok: 'The free arm balances the body.', warn: 'Raise your free arm: point at the ball for balance.', crit: '' } },
        K.tronco([0, 35], [0, 50], { ok: 'Trunk under control.', warn: 'Too much arch or lean in the trunk.', crit: 'Trunk leaning too far: check your approach.' }),
      ],
    },
    {
      id: 'bloqueo', nombre: 'Block', corto: 'Block',
      resumen: 'First line of defense at the net. It can be offensive (direct point) or defensive (takes power off the ball).',
      fases: ['Starting position', 'Movement', 'Jump', 'Takeoff', 'Landing'], vista: 'Front',
      puntos: [
        'About 50 cm from the net, feet parallel at shoulder width, legs slightly bent.',
        'Before takeoff the legs bend more, close to 90°.',
        'Arms fully straight, fingers spread, palms toward the net.',
        'Move arms and hands from the shoulders toward the ball, over the net.',
        'Soft landing on the balls of the feet.',
      ],
      prevencion: 'Landing with aligned knees (not caving in) reduces the load on the ACL (Hewett et al., 2005).',
      jump: true,
      checks: [
        { id: 'elbow', label: 'Arms straight', get: (m) => m.elbowMin, fmt: deg, vis: ARMS, joints: [13, 14], ideal: '≥ 160°', eval: atLeast(160, 140),
          cue: { ok: 'Firm, straight arms.', warn: 'Straighten your arms completely.', crit: 'Bent arms: the ball can pass between hands and net.' } },
        { id: 'up', label: 'Hands above the head', get: (m) => m.wristsAboveNose, fmt: (v) => `${v}/2`, vis: [0, 15, 16], joints: [15, 16], ideal: 'both hands', eval: count2,
          cue: { ok: 'Hands up.', warn: 'Raise the other hand.', crit: 'Raise both hands above your head.' } },
        { id: 'shelev', label: 'Arm elevation', get: (m) => m.shElevMean, fmt: deg, vis: ARMS.concat([23, 24]), joints: [11, 12], ideal: '≥ 150°', eval: atLeast(150, 125),
          cue: { ok: 'Arms well up.', warn: 'Bring your arms higher and forward.', crit: 'Low arms: you do not close the space over the net.' } },
        { id: 'handsw', label: 'Hand spacing', need: 'frontal', get: (m) => m.handsW, fmt: x2, vis: [11, 12, 15, 16], joints: [15, 16], ideal: '0.6–1.5 × shoulders', eval: band(0.6, 1.5, 0.4, 1.9),
          cue: { ok: 'Hands well spaced.', warn: 'Adjust your hand spacing.', crit: 'Hands too wide: the ball goes between them.' } },
        K.base([0.8, 1.4], [0.6, 1.7], { ok: 'Feet shoulder width.', warn: 'Set your feet shoulder width.', crit: 'Base too narrow or too wide.' }),
      ],
    },
    {
      id: 'defensa', nombre: 'Court defense (low position)', corto: 'Defense',
      resumen: 'Third line of defense: digging balls that pass the block. Includes two-hand, one-hand with a fall, and dive.',
      fases: ['Low position', 'Contact', 'Recovery'], vista: 'Front',
      puntos: [
        'Feet slightly wider than shoulders.',
        'Legs deeply bent, weight on the inner edge and balls of the feet (not the heels).',
        'Arms slightly bent at the sides; they join at contact.',
        'Against a hard ball, absorb by drawing the arms toward the body.',
        'Get up quickly for the next play.',
      ],
      prevencion: 'Wearing knee pads and learning falls (roll, dive) prevents direct hits to knees and shoulders.',
      checks: [
        K.rodillas([70, 130], [50, 140], { ok: 'Correct low position.', warn: 'Get a little lower.', crit: 'Too high to defend: bend deeply.' }),
        K.base([1.2, 2.2], [1.0, 2.6], { ok: 'Wide base.', warn: 'Open your feet a little more.', crit: 'Feet too close to defend.' }),
        K.tronco([20, 55], [10, 65], { ok: 'Trunk forward, weight on your toes.', warn: 'Check your trunk lean.', crit: 'Weight back: you will not reach the ball quickly.' }),
        { id: 'arms', label: 'Arms slightly bent', get: (m) => m.elbowMean, fmt: deg, vis: ARMS, joints: [13, 14], ideal: '90–170°', eval: band(90, 170, 70, 180),
          cue: { ok: 'Arms ready.', warn: 'Relax your arms at your sides.', crit: 'Arms tucked: you will not reach the ball.' } },
      ],
    },
    {
      id: 'salto', nombre: 'Vertical jump and landing (test)', corto: 'Jump',
      resumen: 'Countermovement jump test: measures height from flight time and evaluates the landing.',
      fases: ['Countermovement', 'Takeoff', 'Flight', 'Landing'], vista: 'Front (knees), fixed camera',
      puntos: [
        'Arm swing and full extension of hips, knees and ankles.',
        'Land on both feet, front of the foot first.',
        'Bend knees and hips to absorb: a "quiet" landing.',
        'Knees in line with the toes, not caving in (valgus).',
        'Trunk slightly forward, weight shared on both legs.',
      ],
      prevencion: 'With fatigue, the jump drops and the knee bends less on landing (Prieske et al., 2017); that makes jump drop an early warning.',
      jump: true,
      checks: [
        { id: 'kasr', label: 'Knee alignment (valgus)', need: 'frontal', get: (m) => m.kasr, fmt: x2, vis: LEGS, joints: [25, 26], ideal: 'knees/ankles ≥ 0.9', eval: atLeast(0.9, 0.7),
          cue: { ok: 'Knees aligned with the feet.', warn: 'Knees move slightly inward.', crit: 'Valgus: push your knees out, over your toes.' } },
        { id: 'kasym', label: 'Leg symmetry', get: (m) => m.kneeAsym, fmt: deg, vis: LEGS, joints: [25, 26], ideal: 'difference < 10°', eval: atMost(10, 20),
          cue: { ok: 'Load shared on both legs.', warn: 'One leg bends more than the other.', crit: 'Almost all the load on one leg.' } },
        { id: 'kflex', label: 'Knee flexion (now)', get: (m) => m.kneeFlex, fmt: deg, vis: LEGS, joints: [25, 26], ideal: '≥ 60° on landing', eval: () => 'info',
          cue: { info: 'Evaluated automatically on each landing.' } },
        K.tronco([0, 45], [0, 60], { ok: 'Trunk under control.', warn: 'Too much trunk movement.', crit: 'Trunk leaning too far.' }),
      ],
    },
  ];

  BV.GESTOS = GESTOS;
  BV.gesto = (id) => GESTOS.find((g) => g.id === id) || GESTOS[0];
})(window.BV);
