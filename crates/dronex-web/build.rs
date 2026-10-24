//! Stamps the wasm build with its commit and build time, for `daemon/about`
//! in the browser (S87). The same script as the installed DroneX's.

include!("../dronex/stamp.rs");

fn main() {
    stamp();
    println!("cargo:rerun-if-env-changed=DRONEX_RELEASE_PUBLIC_KEY");
}
