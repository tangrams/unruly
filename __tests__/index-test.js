'use strict';
jest.dontMock('../index');
jest.dontMock('./style');
jest.dontMock('match-feature');

describe('Rule', () => {
    let {Rule} = require('../index');

    it('returns an new instanceof', () => {
        let subject = new Rule({name: 'name'});
        expect(subject instanceof Rule).toBe(true);
        expect(subject.name).toEqual('name');
        expect(typeof subject.buildStyle).toEqual('function');
    });

});

describe('RuleGroup', () => {
    let {RuleGroup} = require('../index');

    it('returns an new instanceof', () => {
        let subject = new RuleGroup({name: 'test'});
        expect(subject instanceof RuleGroup).toBe(true);
        expect(subject.name).toEqual('test');
    });
});

describe('.cloneStyle()', () => {
    let {cloneStyle} = require('../index');

    describe('when given a deeply nested object',  () => {
        it('merged the properies at any depth',  () => {
            expect(cloneStyle(
                {a: 3, c: 1, d: {a: 4, c: 10}},
                {a: 2, b: 3, d: {d: ['a']}},
                {a: 1, c: 4, d: {b: 5}}
            )).toEqual({
                a: 1,
                b: 3,
                c: 4,
                d: { a: 4, b: 5, c: 10, d: ['a']}
            });
        });
    });
});

describe('.parseRules(rules)', () => {

    let {parseRules, walkDown, RuleTree} = require('../index'),
        ruleTree   = require('./style');

    describe('when given a raw ruleTree', () => {

        it('returns a RuleGroup', () => {

            expect(parseRules(ruleTree) instanceof RuleTree)
                .toBe(true);
        });

        it('returns the correct number of children rules', () => {
            let tree = parseRules(ruleTree);
            let number = 0;

            walkDown(tree, (rule) => {
                number += 1;
            });

            expect(number).toEqual(3);
        });
    });
});

describe('.parseRuleTree()', () => {});



describe('.buildFilter()', () => {});

describe('.groupProps()', () => {
    let {groupProps} = require('../index');

    describe('given an object ', () => {
        let subject = {
            style: { a: 1 },
            filter: 'I am a filter',
            a: 'b',
            b: 'c'
        };

        it('groups the properties by white listing', () => {
            expect(groupProps(subject)).toEqual(
                [
                    {
                        style: { a: 1 },
                        filter: 'I am a filter'
                    },
                    {
                        a: 'b',
                        b: 'c'
                    }
                ]);
        });
    });
});

describe('.calculateStyle()', () => {
    let {calculateStyle} = require('../index');

    let a = {
        parent: null,
        style: {
            a: true
        }
    };
    let b = {
        parent: a,
        style: {
            b: true
        }
    };

    let c = {
        parent: b,
        style: {
            c: true
        }
    };

    it('calculates a rules inherited style', () => {
        expect(calculateStyle(c, [])).toEqual(
            [{ a: true }, { b: true }, { c: true }]
        );
    });

});

describe('RuleGroup.findMatchingRules(context)', () => {
    let subject;
    let {parseRules} = require('../index');

    beforeEach(() => {
        subject = parseRules(
            {
                earth: {
                    filter: {
                        kind: 'highway'
                    },
                    style: {
                        color: [1, 2, 3]
                    },
                    fillA: {
                        filter: {
                            name: 'FDR'
                        },
                        style: {}
                    }
                },
                roads: {
                    filter: {
                        '@zoom': { min: 3}
                    },
                    style: {
                        color: [7, 8, 9]
                    },
                    fillB: {
                        filter: {
                            id: 10
                        },
                        style: {
                            color: [10, 11, 12]                            
                        }
                    }
                }
            }
        );
    });

    afterEach(() => {
        subject = null;
    });
    
    describe('when the feature is a highway and is named FDR', () => {
        let context = {
            feature: {
                properties: {
                    kind: 'highway',
                    name: 'FDR',
                    id: 10
                }
            },
            zoom: 3
        };

        it('returns the correct number of matching rules', () => {
            let rules = subject.findMatchingRules(context);
            expect(rules.length).toEqual(2);
        });

        describe('when we ask to flatten the rule tree', () => {
            it('returns a single object', () => {
                let rule = subject.findMatchingRules(context, true);
                expect(rule).toEqual({
                    color: [10, 11, 12],
                    order: 0,
                    visible: true
                });
            });
        });
    });

    describe('when the feature is not a road', () => {});
    describe('when the feature matches only one feature', () => {});
    describe('when the feature does not match any filters', () => {});
});




