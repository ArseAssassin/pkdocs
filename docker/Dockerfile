FROM ghcr.io/nixos/nix
RUN nix --experimental-features "nix-command flakes" profile install "github:ArseAssassin/pikadoc/development" --impure
RUN nix --experimental-features "nix-command flakes" profile install nixpkgs#nodejs_20
RUN nix --experimental-features "nix-command flakes" profile install nixpkgs#python311
VOLUME ["/pkdocs"]
ENTRYPOINT pikadoc
