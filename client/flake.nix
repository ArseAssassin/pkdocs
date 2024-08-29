{
  description = "todo.yaml CLI";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-23.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = import nixpkgs {
            inherit system;
          };
        in
        {
          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_20
              ffmpeg_5
              sqlite
              litecli
              inotify-tools
            ];
          };
        }
      );
}