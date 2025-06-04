let vaporPhase = [],
  liquidPhase = [];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function computeKValuesUsingWilson(T, P) {
  const Tc = [190.6, 469.7, 540.2, 594.6, 617.7, 658.1, 723.0, 698.0]; // Kelvin
  //const Pc = [45.99, 33.7, 27.4, 23.9, 21.0, 18.2, 13.8, 15.0]; // bar
  const omega = [0.011, 0.251, 0.349, 0.491, 0.49, 0.574, 0.7, 0.65];

  const lightEndsCorrection = 1.1;
  const K = [];

  for (let i = 0; i < Tc.length; i++) {
    // const Tr = T / Tc[i];  // Unused but available if needed
    // const Pr = P / Pc[i];  // Unused but kept for parity

    const exponent = 5.373 * (1 + omega[i]) * (1 - Tc[i] / T);
    let Ki = Math.pow(10, exponent);

    if (i < 4) {
      Ki *= lightEndsCorrection;
    }

    // Clamp Ki between 1e-4 and 100
    Ki = Math.min(Math.max(Ki, 1e-4), 100.0);

    K.push(Ki);
  }

  return K;
}

function solveVaporFraction(z, K) {
  let V = 0.5;
  const tol = 1e-6;
  const maxIter = 100;
  const allK1 = K.every((Ki) => Math.abs(Ki - 1.0) < 1e-8);
  if (allK1) return 0.0;

  for (let iter = 0; iter < maxIter; iter++) {
    let f = 0.0,
      df = 0.0;
    for (let i = 0; i < z.length; i++) {
      const Ki = K[i];
      const zi = z[i];
      const denom = Math.max(1e-10, 1 + V * (Ki - 1));
      const term = (zi * (Ki - 1)) / denom;
      f += term;
      df -= (zi * Math.pow(Ki - 1, 2)) / (denom * denom);
    }
    if (Math.abs(df) < 1e-12) break;
    const dV = -f / df;
    V = clamp(V + dV, 0.0, 1.0);
    if (Math.abs(dV) < tol) break;
  }
  return V;
}

export function performNR_RRFlash(feedComposition) {
  const T = 340.0 + 273.15;
  const P = 1.15;
  const K = computeKValuesUsingWilson(T, P);

  const flashVaporFraction = solveVaporFraction(feedComposition, K);
  const x = Array(feedComposition.length);
  const y = Array(feedComposition.length);

  if (flashVaporFraction === 0.0) {
    return {
      vaporFraction: 0.0,
      liquidPhase: [...feedComposition],
      vaporPhase: Array(feedComposition.length).fill(0.0),
    };
  }

  if (flashVaporFraction === 1.0) {
    return {
      vaporFraction: 1.0,
      vaporPhase: [...feedComposition],
      liquidPhase: Array(feedComposition.length).fill(0.0),
    };
  }

  let liquidPhase = [];
  let vaporPhase = [];
  for (let i = 0; i < feedComposition.length; i++) {
    const denom = 1.0 + flashVaporFraction * (K[i] - 1.0);
    const xi = feedComposition[i] / denom;
    const yi = K[i] * xi;
    liquidPhase[i] = xi;
    vaporPhase[i] = yi;
  }

  const xsum = liquidPhase.reduce((a, b) => a + b, 0.0);
  const ysum = vaporPhase.reduce((a, b) => a + b, 0.0);

  for (let i = 0; i < feedComposition.length; i++) {
    x[i] = liquidPhase[i] / xsum;
    y[i] = vaporPhase[i] / ysum;
  }

  return {
    vaporFraction: flashVaporFraction,
    liquidPhase: x,
    vaporPhase: y,
  };
}

const R = 8.314;
const sqrt2 = Math.sqrt(2);

function computePRParams(Tc, Pc, omega, T, P) {
  const Tr = T / Tc;
  const kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega * omega;
  const alpha = Math.pow(1 + kappa * (1 - Math.sqrt(Tr)), 2);

  const a = (0.45724 * R * R * Tc * Tc) / Pc;
  const b = (0.0778 * R * Tc) / Pc;
  const A = (a * alpha * P) / (R * R * T * T);
  const B = (b * P) / (R * T);

  return { a, b, alpha, A, B };
}

function solveCubicEOS(A, B) {
  const a2 = -(1.0 - B);
  const a1 = A - 3.0 * B * B - 2.0 * B;
  const a0 = -(A * B - B * B - B * B * B);

  const Q = (3 * a1 - a2 * a2) / 9;
  const R_ = (9 * a2 * a1 - 27 * a0 - 2 * Math.pow(a2, 3)) / 54;
  const D = Q * Q * Q + R_ * R_;

  const roots = [];

  if (D >= 0) {
    const S = Math.cbrt(R_ + Math.sqrt(D));
    const T = Math.cbrt(R_ - Math.sqrt(D));
    const Z1 = -a2 / 3 + S + T;
    roots.push(Z1);
  } else {
    const theta = Math.acos(R_ / Math.sqrt(-Q * Q * Q));
    const sqrtQ = Math.sqrt(-Q);
    for (let k = 0; k < 3; k++) {
      const Zk = 2 * sqrtQ * Math.cos((theta + 2 * Math.PI * k) / 3) - a2 / 3;
      roots.push(Zk);
    }
  }

  return roots.sort((a, b) => a - b);
}

function computeFugacityCoeff(Z, bi, B_mix, ai, a_mix, A_mix, B) {
  const term1 = (bi / B_mix) * (Z - 1);
  const term2 = -Math.log(Z - B);
  const term3 =
    (A_mix / (B_mix * sqrt2)) *
    ((2 * ai) / a_mix - bi / B_mix) *
    Math.log((Z + (1 + sqrt2) * B) / (Z + (1 - sqrt2) * B));
  return Math.exp(term1 + term2 - term3);
}

function PR_EOS_RRFlash(z, Tc, Pc, omega, T, P, x, y) {
  const N = z.length;
  const params = Tc.map((_, i) =>
    computePRParams(Tc[i], Pc[i], omega[i], T, P)
  );
  const a_i = params.map((p) => p.a * p.alpha);
  const b_i = params.map((p) => p.b);

  let a_mix = 0,
    b_mix = 0;
  for (let i = 0; i < N; i++) {
    b_mix += z[i] * b_i[i];
    for (let j = 0; j < N; j++) {
      a_mix += z[i] * z[j] * Math.sqrt(a_i[i] * a_i[j]);
    }
  }

  const A_mix = (a_mix * P) / (R * R * T * T);
  const B_mix = (b_mix * P) / (R * T);

  const Z_roots = solveCubicEOS(A_mix, B_mix);
  const Z_vap = Z_roots[Z_roots.length - 1];
  const Z_liq = Z_roots[0];

  const phi_vap = [],
    phi_liq = [],
    K = [];

  for (let i = 0; i < N; i++) {
    phi_vap[i] = computeFugacityCoeff(
      Z_vap,
      b_i[i],
      B_mix,
      a_i[i],
      a_mix,
      A_mix,
      B_mix
    );
    phi_liq[i] = computeFugacityCoeff(
      Z_liq,
      b_i[i],
      B_mix,
      a_i[i],
      a_mix,
      A_mix,
      B_mix
    );
    K[i] = phi_liq[i] / phi_vap[i];
  }

  let flashVaporFraction = solveVaporFraction(z, K);

  if (flashVaporFraction === 0.0) {
    liquidPhase = [...z];
    vaporPhase = Array(z.length).fill(0.0);
  } else if (flashVaporFraction === 1.0) {
    vaporPhase = [...z];
    liquidPhase = Array(z.length).fill(0.0);
  } else {
    vaporPhase = [];
    liquidPhase = [];
    for (let i = 0; i < z.length; i++) {
      const denom = 1.0 + flashVaporFraction * (K[i] - 1.0);
      const xi = z[i] / denom;
      const yi = K[i] * xi;
      liquidPhase[i] = xi;
      vaporPhase[i] = yi;
    }
    const xsum = liquidPhase.reduce((a, b) => a + b, 0.0);
    const ysum = vaporPhase.reduce((a, b) => a + b, 0.0);
    for (let i = 0; i < z.length; i++) {
      x[i] = liquidPhase[i] /= xsum;
      y[i] = vaporPhase[i] /= ysum;
    }
  }

  return flashVaporFraction;
}

export function performPR_EOS_RRFlash(feedComposition) {
  const T = 340.0 + 273.15;
  const P = 1.15;
  const Tc = [190.6, 469.7, 540.2, 594.6, 617.7, 658.1, 723.0, 698.0];
  const Pc = [45.99, 33.7, 27.4, 23.9, 21.0, 18.2, 13.8, 15.0];
  const omega = [0.011, 0.251, 0.349, 0.491, 0.49, 0.574, 0.7, 0.65];
  const x = Array(feedComposition.length);
  const y = Array(feedComposition.length);
  let flashVaporFraction = PR_EOS_RRFlash(
    feedComposition,
    Tc,
    Pc,
    omega,
    T,
    P,
    x,
    y
  );

  return {
    vaporFraction: flashVaporFraction,
    liquidPhase,
    vaporPhase,
  };
}
