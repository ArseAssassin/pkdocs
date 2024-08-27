export def generate-index [] {
  each {|doc|
    open $doc.name|from yaml|get 0
  }
}