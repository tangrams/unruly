'use strict';
jest.dontMock('../index');
jest.dontMock('./style');
jest.dontMock('match-feature');

describe('Rule', () => {
    let Rule = require('../index').Rule;

    it('returns an new instanceof', () => {
        let subject = new Rule({name: 'name'});
        expect(subject instanceof Rule).toBe(true);
        expect(subject.name).toEqual('name');
        expect(typeof subject.buildStyle).toEqual('function');
    });

});

describe('RuleGroup', () => {
    let RuleGroup = require('../index').RuleGroup;

    it('returns an new instanceof', () => {
        let subject = new RuleGroup({name: 'test'});
        expect(subject instanceof RuleGroup).toBe(true);
        expect(subject.name).toEqual('test');
    });
});

describe('.cloneStyle()', () => {
    let cloneStyle = require('../index').cloneStyle;

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

    let subject    = require('../index').parseRules,
        walkDown   = require('../index').walkDown,
        RuleGroup  = require('../index').RuleGroup,
        ruleTree   = require('./style');

    describe('when given a raw ruleTree', () => {

        it('returns a RuleGroup', () => {

            expect(subject(ruleTree) instanceof RuleGroup)
                .toBe(true);
        });

        it('returns the correct number of children rules', () => {
            let tree = subject(ruleTree);
            let number = 0;

            walkDown(tree, (rule) => {
                number += 1;
            });

            expect(number).toEqual(16);
        });
    });
});

describe('.parseRuleTree()', () => {});



describe('.buildFilter()', () => {});

describe('.groupProps()', () => {
    let groupProps = require('../index').groupProps;

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
    let calculateStyle = require('../index').calculateStyle;
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

describe.only('RuleGroup.findMatchingRules(context)', () => {
    let subject,
        walkDown   = require('../index').walkDown,
        parseRules = require('../index').parseRules,
        ruleTree   = JSON.stringify(require('./style'));

    beforeEach(() => {
        subject = parseRules(JSON.parse(ruleTree));
    });

    afterEach(() => {
        subject = null;
    });
    
    describe('when the feature is a road and a highway', () => {
        let context = {
            feature: {
                properties: {
                    kind: 'highway',
                    name: 'FDR'
                }
            }
        };

        it('returns the correct number', () => {

            walkDown(subject, (r) => {
                console.log(r.name);
            });

            let rules = subject.findMatchingRules(context);
            console.log(rules);
        });

    });

    describe('when the feature is not a road', () => {});
    describe('when the feature matches only one feature', () => {});
    describe('when the feature does not match any filters', () => {});
});




