export def generate-index [] {
  each {|doc|
    open $doc.name
    |from yaml
    |get 0
    |merge { path: $doc.name }
    |reject -i license copyright description
  }
}

export def sync-devdocs [savePath:string, maxFileSize:string='1Mb'] {
  # blacklisted docs cause parser to fail
  const BLACKLIST = ['bluebird', 'date_fns', 'koa', 'spring_boot']

  let repo = doc s index|get name

  doc src:devdocs index
  |where { not ($in.name in $repo) and not ($in.slug in $BLACKLIST) }
  |uniq-by name
  |take 100
  |each {
    let slug = $in.slug
    let archive = http get $"https://downloads.devdocs.io/($slug).tar.gz"

    if (($archive|bytes length|into filesize) < ($maxFileSize|into filesize)) {
      print $"Using ($slug)"
      doc src:devdocs use $slug
      doc save $"($savePath)/(doc pkd-about|get slug).pkd"
    }
  }
}

# export def sync-npm [savePath:string] {
#   let packages = $in

#   $packages
#   |each {|package|
#     let latest = npm view $package|parse '{name}@{version} {rest}'|get 0.version
#     let path = $savePath|path join ($package + $"@($latest).pkd")
#     if (not ($path|path exists)) {
#       doc src:npm use $package
#       doc save $path
#       doc pkd-about|select name version
#     }
#   }
# }

export def 'do-pip 1' [] {
  open /pkdocs/feed.yml|get python|install-pip-packages
}

export def 'do-pip 2' [] {
  open /pkdocs/feed.yml|get python|sync-pip '/output/python'
}

export def install-pip-packages [] {
  let packages = $in
  run-external 'nix-shell' '--run' 'pikadoc' '-p' ...(
    $packages|each {$"python311Packages.($in.package)"}
  )
}

export def sync-pip [savePath:string] {
  let packages = $in

  $packages
  |each {|package|
    let moduleName = ($package.module?|default $package.package)
    let versionCommand = $"print\(__import__\(($moduleName|to json)\).__version__\)"
    let version = python3 -c $versionCommand|complete|get stdout|lines|last
    let path = $savePath|path join $"($package.package)~($version).pkd"

    if (not ($path|path exists)) {
      doc src:python use $moduleName
      $env.PKD_CURRENT.about.name = $package.package
      $env.PKD_CURRENT.about.version = $version
      if ($env.PKD_CURRENT.about.license? == null) {
        $env.PKD_CURRENT.about.license = $package.license
      }
      doc save $path
    }
    $path
  }
}