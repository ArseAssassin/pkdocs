export def generate-index [] {
  each {|doc|
    open $doc.slug|from yaml|get 0
  }
}