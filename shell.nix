{ pkgs ? import <nixpkgs> {
    config = { allowUnfree = true; android_sdk.accept_license = true; };
  }
}:
pkgs.mkShell {
  buildInputs = [ pkgs.nodejs_22 pkgs.temurin-bin-17 pkgs.unzip pkgs.git ];
  shellHook = ''
    export ANDROID_HOME="$HOME/android-sdk"
    export ANDROID_SDK_ROOT="$ANDROID_HOME"
    export JAVA_HOME="${pkgs.temurin-bin-17}"
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
    echo "on-foot-rn dev shell. Node: $(node -v), Java: $(java -version 2>&1 | head -1)"
  '';
}
