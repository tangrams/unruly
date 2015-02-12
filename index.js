'use strict';

export let whiteList = ['filter', 'style', 'geometry'];

let RuleMixin = {

    buildStyle() {
        return calculateStyle(this);
    },

    toJSON() {
        return {
            name: this.name,
            sytle: this.style
        };
    }

}

export class Rule {

    constructor({name, parent, style}) {
        this.name = name;
        this.parent = parent;
        this.style = style;
        Object.assign(this, RuleMixin);
    }
}


export class RuleGroup {

    constructor({name, parent, style, rules}) {
        this.name = name;
        this.parent = parent;
        this.style = style;
        this.rules = rules || [];
        Object.assign(this, RuleMixin);
    }

    addRule(rule) {
        this.rules.push(rule);        
    }

    findMatchingRules(context) {
        let rules = [];
        matchFeature(context, this.rules, rules);
        return rules;
    }

}

function isWhiteListed(key) {
    return whiteList.indexOf(key) > -1;
}

function isEmpty(obj) {
    return Object.getOwnPropertyNames(obj) === 0;
}

export function walkUp(rule, cb) {

    if (rule.parent) {
        walkUp(rule.parent, cb)
    }

    cb(rule);
}

export function walkDown(rule, cb) {
    if (rule.rules) {

        rule.rules.forEach((r) => {
            walkDown(r, cb);
        });
    }

    cb(rule);
}

export function groupProps(obj) {
    let whiteListed = {}, nonWhiteListed = {};

    for (let key in obj) {
        if (isWhiteListed(key)) {
            whiteListed[key] = obj[key];
        } else {
            nonWhiteListed[key] = obj[key];
        }
    }
    return [whiteListed, nonWhiteListed];
}

function buildFilter(rule) {
    var type = typeof rule.filter;
    switch (type) {
    case 'object':
        return mf.match(rule.filter);
    case 'function':
        return rule.filter;
    }
}

export function calculateStyle(rule, styles = []) {

    walkUp(rule, (r) =>{
        if (r.style) {
            styles.push(r.style);
        }
    });

    return styles;
}

export function cloneStyle(newObj, ...sources) {

    for (let source of sources) {
        for (let key in source) {
            let value = source[key];
            if (typeof value === 'object' && !Array.isArray(value)) {
                newObj[key] = cloneStyle(newObj[key] || {}, value);
            } else {
                newObj[key] = value;
            }
        }

    }
    return newObj;
}

export function parseRuleTree(name, rule, parent) {
    let properties = {name, parent};
    let [whiteListed, nonWhiteListed] = groupProps(rule);
    let create = isEmpty(nonWhiteListed) ? Rule : RuleGroup;
    let r = new create(properties);

    parent.addRule(r);

    for (let name in nonWhiteListed) {
        let property = nonWhiteListed[name];

        if (typeof property === 'object') {
            parseRuleTree(name, property, r);
        }
    }

    return parent;
}


export function parseRules(rules) {
    let ruleTree = new RuleGroup({name: '_'});

    for (let name in rules) {
        let rule = rules[name];
        let root = new RuleGroup({name});
        ruleTree.addRule(parseRuleTree(name, rule, root));
    }

    return ruleTree;
}


function doesMatch(filter, context) {
    return ((typeof filter === 'function' && filter(context)) || (filter == null));
}

export function matchFeature(context, rules, collectedRules) {
    let current;
    let matched = false;
    let childMatched = false;

    if (rules.length === 0) { return; }

    for (let current of rules) {

        if (current instanceof Rule) {
            if (current.calculateStyle) {

                if (doesMatch(current.filter, context)) {
                    matched = true;
                    collectedRules.push(current);
                }
            } else if (current instanceof RuleGroup) {
                if (doesMatch(current.filter, context)) {
                    matched = true;
                    childMatched = matchFeature(context, current.rules, collectedRules);
                    if (!childMatched && current.calculatedStyle) {
                        collectedRules.push(current);
                    }
                }
            }
        }
    }
    return matched;
}
