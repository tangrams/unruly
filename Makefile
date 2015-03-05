
lib/unruly.js: index.js
	./node_modules/babel/bin/babel/index.js index.js --optional=runtime > lib/unruly.js

clean:
	rm lib/unruly.js

.PHONY: clean
