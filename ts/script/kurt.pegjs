{
  function _sym(name) { return { "[sym]": name }}
  function _quote(expr) { return { "[q]": expr }}
  function _fquote(expr) { return { "[fq]": expr }}
}

start = _ expr:expr _ { return expr }

expr
  = prim
  / pipe
  / listaccess
  / access
  / quote
  / fquote
  / unquote
  / sym
  / list
  / short_block
  / dict

_ = (ws comment)* ws / ws
ws = [ \t\r\n]*
comment = single / multi
multi =  "-[" (!"]-" .)* "]-" { return null }
single = "--" ([^\n]*)[\n] { return null }

pipe = "|" { return _sym("|") }

prim
  = real
  / integer
  / string
  / boolean
  / nil

integer
  = neg:"-"? digits:[0-9]+ {
    let num = parseInt(digits.join(""), 10)
    return neg ? -num : num;
  }

// TODO: Scientific notation.
real = neg:"-"? left:[0-9]+ "." right:[0-9]+ {
  let num = parseFloat(left.join("") + "." +   right.join(""));
  return neg ? -num : num;
}

string
  = "\"" chars:[^"]* "\"" { return chars.join("") }

boolean
  = "true"  { return true }
  / "false" { return false }

nil = "nil" { return undefined }

sym
  = chars:[^ \t\r\n\[\]{}():|]+ { return _sym(chars.join("")) }

quote
  = ":" expr:expr { return _quote(expr) }

fquote
  = "\\" expr:expr { return _fquote(expr) }

unquote
  = "/" expr:expr { return [_sym("/"), expr] }

listaccess
  = l:list ":" + q:sym {
  	return [l, _quote(q)]
  }

access
  = s:(sym ":")+ q:sym {
  	let result = [s[0][0]];
  	for (let i = 1; i < s.length; i++) {
    	result.push(_quote(s[i][0]));
    	result = [result];
    }
    result.push(_quote(q));
    return result;
  }

list
  = "[" items:list_item* _ "]" { return items }

short_block
  = "(" items:list_item* _ ")" {
    for (var it of items) {
      if (it && it["[sym]"] == "|") {
        return items;
      }
    }
    items.unshift(_sym("|"));
    return items
  }

list_item = _ expr:expr { return expr }

dict
  = "{" entries:dict_entry* _ "}" {
    let r = {};
    for (let e of entries) {
      r[e[0]["[sym]"]] = e[1]
    }
    return r
  }

dict_entry
  = _ key:sym _ ":" _ val:expr { return [key, val] }
  / _ key:sym { return [key, key] }
