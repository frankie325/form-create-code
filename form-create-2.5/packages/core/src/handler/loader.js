import extend from '@form-create/utils/lib/extend';
import {byCtx, copyRule, enumerable, getRule, invoke, parseFn} from '../frame/util';
import is, {hasProperty} from '@form-create/utils/lib/type';
import {err} from '@form-create/utils/lib/console';
import {baseRule} from '../factory/creator';
import RuleContext from '../factory/context';
import mergeProps from '@form-create/utils/lib/mergeprops';

export default function useLoader(Handler) {
    extend(Handler.prototype, {
        nextRefresh(fn) {
            const id = this.loadedId;
            this.vm.$nextTick(() => {
                id === this.loadedId && (fn ? fn() : this.refresh());
            });
        },
        // 处理rule中的一些属性
        parseRule(_rule) {
            const rule = getRule(_rule);

            // 定义rule.__origin__，指向最初始的rule
            Object.defineProperties(rule, {
                __origin__: enumerable(_rule, true)
            });

            fullRule(rule); // 给rule添加最基本的配置项
            this.appendValue(rule);

            rule.options = Array.isArray(rule.options) ? rule.options : [];

            /*
                2.5.0新增prefix和suffix
                rule = {
                    prefix:{
                        type:'ElButton', children:['prefix'], props:{loading:true}
                    },
                    suffix:{
                        type:'ElButton', children:['suffix'], props:{loading:true}
                    },
                },
            */
            [rule, rule['prefix'], rule['suffix']].forEach(item => {
                if (!item) {
                    return;
                }
                this.loadFn(item, rule);
            });
            this.loadCtrl(rule);

            if (rule.update) {
                rule.update = parseFn(rule.update);
            }
            return rule;
        },
        //为rule中下列属性中的方法进行参数注入
        loadFn(item, rule) {
            ['on', 'props', 'nativeOn', 'deep'].forEach(k => {
                item[k] && this.parseInjectEvent(rule, item[k]);
            });
        },
        // 处理组件联动rule.control中的handle方法
        loadCtrl(rule) {
            rule.control && rule.control.forEach(ctrl => {
                if (ctrl.handle) {
                    ctrl.handle = parseFn(ctrl.handle)
                }
            })
        },
        // 处理rule.sync，设置props中属性的双向绑定
        syncProp(ctx) {
            const rule = ctx.rule;
            is.trueArray(rule.sync) && mergeProps([{
                /*
                    rule.sync:["xxx"]
                    生成on事件对象，进行双向绑定
                    {
                        "update:xxx":() => {},
                        ...
                    }
                */ 
                on: rule.sync.reduce((pre, prop) => {
                    pre[`update:${prop}`] = (val) => {
                        rule.props[prop] = val; //更新props里的值
                        this.vm.$emit('sync', prop, val, rule, this.fapi);
                    }
                    return pre
                }, {})
            }], ctx.computed) //合并到ctx.computed中
        },
        loadRule() {
            // console.warn('%c load', 'color:blue');
            this.cycleLoad = false;
            this.loading = true;
            if (this.pageEnd) {
                this.bus.$emit('load-start');
            }
            this.deferSyncValue(() => {
                this._loadRule(this.rules);
                this.loading = false;
                if (this.cycleLoad && this.pageEnd) {
                    return this.loadRule();
                }
                if (this.pageEnd) {
                    this.bus.$emit('load-end');
                }
                this.vm._renderRule();
                this.$render.initOrgChildren(); //初始化this.orgChildren
                this.syncForm();
            });
        },
        loadChildren(children, parent) {
            this.cycleLoad = false;
            this.loading = true;
            this.bus.$emit('load-start');
            this._loadRule(children, parent); //递归调用_loadRule
            this.loading = false;
            if (this.cycleLoad) {
                return this.loadRule();
            } else {
                this.bus.$emit('load-end');
                this.syncForm();
            }
            this.$render.clearCache(parent);
        },
        /*
            
        */
        _loadRule(rules, parent) {

            const preIndex = (i) => {
                let pre = rules[i - 1]; //拿到该规则的前一个规则

                if (!pre || !pre.__fc__) { //如果前一个不存在，继续往前找，找不到则返回-1
                    return i > 0 ? preIndex(i - 1) : -1;
                }

                let index = this.sort.indexOf(pre.__fc__.id); //拿到前一个rule在handler.sort数组中的index
                return index > -1 ? index : preIndex(i - 1); //不存在则继续向前找
            }

            const loadChildren = (children, parent) => {
                if (is.trueArray(children)) {
                    this._loadRule(children, parent);
                }
            };

            rules.map((_rule, index) => {
                if (parent && (is.String(_rule) || is.Undef(_rule))) return; //存在父级，且无效的rule，比如字符，直接跳过

                if (!this.pageEnd && !parent && index >= this.first) return;

                if (!is.Object(_rule) || !getRule(_rule).type) //rule非数组或没有定义rule.type，报错
                    return err('未定义生成规则的 type 字段', _rule);

                if (_rule.__fc__ && _rule.__fc__.root === rules && this.ctxs[_rule.__fc__.id]) {
                    loadChildren(_rule.__fc__.rule.children, _rule.__fc__);
                    return _rule.__fc__;
                }
                // rule如果是由maker生成，则为creator实例，执行getRule方法，得到rule
                let rule = getRule(_rule);

                // 判断rule.field是否重复
                const isRepeat = () => {
                    return !!(rule.field && this.fieldCtx[rule.field] && this.fieldCtx[rule.field][0] !== _rule.__fc__)
                }

                // 触发自定义属性的init方法
                this.ruleEffect(rule, 'init', {repeat: isRepeat()});

                if (isRepeat()) {
                    this.vm.$emit('repeat-field', _rule, this.api);
                }

                let ctx;
                let isCopy = false;
                let isInit = !!_rule.__fc__; //存在__fc__，说明已经创建了对应的RuleContext实例
                if (isInit) {
                    ctx = _rule.__fc__; 
                    const check = !ctx.check(this);
                    if (ctx.deleted) {
                        if (check) {
                            if (isCtrl(ctx)) {
                                return;
                            }
                            ctx.update(this);
                        }
                    } else {
                        if (check) {
                            if (isCtrl(ctx)) {
                                return;
                            }
                            rules[index] = _rule = _rule._clone ? _rule._clone() : copyRule(_rule);
                            ctx = null;
                            isCopy = true;
                        }
                    }
                }
                if (!ctx) { //如果rule对应的RuleContext实例还没创建
                    ctx = new RuleContext(this, this.parseRule(_rule)); //创建RuleContext实例
                    this.bindParser(ctx); // 设置parser对象到RuleContext实例
                } else {
                    // 存在时

                    if (ctx.originType !== ctx.rule.type) {
                        ctx.updateType();
                        this.bindParser(ctx);
                    }
                    this.appendValue(ctx.rule);
                }

                // 处理rule.emit / rule.nativeEmit
                [false, true].forEach(b => this.parseEmit(ctx, b));
                // 处理rule.sync，设置props中属性的双向绑定
                this.syncProp(ctx);
                ctx.parent = parent || null;
                ctx.root = rules;
                // 将RuleContext实例设置到handler.ctxs
                this.setCtx(ctx);

                !isCopy && !isInit && this.effect(ctx, 'load');

                ctx.parser.loadChildren === false || loadChildren(ctx.rule.children, ctx); //处理rule.children


                // 将rule对应的ctx.id按顺序推入到handler.sort
                if (!parent) {
                    // 如果不存在父级
                    const _preIndex = preIndex(index); //找到该rule前一个在handler.sort中的索引

                    if (_preIndex > -1 || !index) {
                        //进行插入
                        this.sort.splice(_preIndex + 1, 0, ctx.id);
                    } else {
                        // 否则推入到数组末尾
                        this.sort.push(ctx.id);
                    }
                }

                const r = ctx.rule;
                if (!ctx.updated) {
                    ctx.updated = true;
                    if (is.Function(r.update)) {
                        this.bus.$once('load-end', () => {
                            this.refreshUpdate(ctx, r.value);
                        });
                    }
                    this.effect(ctx, 'loaded'); //触发自定义属性的loaded方法
                }

                if (ctx.input) //rule.field存在，则为true
                // 拦截rule.value
                    Object.defineProperty(r, 'value', this.valueHandle(ctx));
                if (this.refreshControl(ctx)) this.cycleLoad = true;
                return ctx;
            });
        },
        refreshControl(ctx) {
            return ctx.input && ctx.rule.control && this.useCtrl(ctx);
        },
        useCtrl(ctx) {
            // 拿到rule.control
            const controls = getCtrl(ctx), validate = [], api = this.api;
            if (!controls.length) return false;

            for (let i = 0; i < controls.length; i++) {
                const control = controls[i], handleFn = control.handle || (val => val === control.value);
                // 如果control.rule不是数组，跳过
                if (!is.trueArray(control.rule)) continue;

                const data = {
                    ...control,
                    valid: invoke(() => handleFn(ctx.rule.value, api)), //是否符合handle方法的条件
                    ctrl: findCtrl(ctx, control.rule),
                    isHidden: is.String(control.rule[0]),
                };
                if ((data.valid && data.ctrl) || (!data.valid && !data.ctrl && !data.isHidden)) continue;
                validate.push(data);
            }
            if (!validate.length) return false;

            let flag = false;
            this.deferSyncValue(() => {
                validate.reverse().forEach(({isHidden, valid, rule, prepend, append, child, ctrl}) => {
                    if (isHidden) {
                        valid ? ctx.ctrlRule.push({
                            __ctrl: true,
                            children: rule,
                            valid
                        })
                            : ctx.ctrlRule.splice(ctx.ctrlRule.indexOf(ctrl), 1);
                        this.vm.$nextTick(() => {
                            this.api.hidden(!valid, rule);
                        });
                        return;
                    }
                    if (valid) {
                        flag = true;
                        const ruleCon = {
                            type: 'fcFragment',
                            native: true,
                            __ctrl: true,
                            children: rule,
                        }
                        ctx.ctrlRule.push(ruleCon);
                        this.bus.$once('load-start', () => {
                            // this.cycleLoad = true;
                            if (prepend) {
                                api.prepend(ruleCon, prepend, child)
                            } else if (append || child) {
                                api.append(ruleCon, append || ctx.id, child)
                            } else {
                                ctx.root.splice(ctx.root.indexOf(ctx.origin) + 1, 0, ruleCon);
                            }
                        });
                    } else {
                        ctx.ctrlRule.splice(ctx.ctrlRule.indexOf(ctrl), 1);
                        const ctrlCtx = byCtx(ctrl);
                        ctrlCtx && ctrlCtx.rm();
                    }
                });
            });
            this.vm.$emit('control', ctx.origin, this.api);
            this.effect(ctx, 'control');
            return flag;
        },
        reloadRule(rules) {
            return this._reloadRule(rules);
        },
        _reloadRule(rules) {
            // console.warn('%c reload', 'color:red');
            if (!rules) rules = this.rules;

            const ctxs = {...this.ctxs};

            this.clearNextTick();
            this.$render.clearOrgChildren();
            this.initData(rules);
            this.fc.rules = rules;

            this.bus.$once('load-end', () => {
                Object.keys(ctxs).filter(id => this.ctxs[id] === undefined)
                    .forEach(id => this.rmCtx(ctxs[id]));
                this.$render.clearCacheAll();
            });
            this.reloading = true;
            this.loadRule();
            this.reloading = false;
            this.refresh();

            this.bus.$off('next-tick', this.nextReload);
            this.bus.$once('next-tick', this.nextReload);
            this.vm.$emit('update', this.api);
        },
        //todo 组件生成全部通过 alias
        refresh() {
            this.vm._refresh();
        },
    });
}


// 给rule添加最基本的配置项
function fullRule(rule) {
    const def = baseRule();// 得到最基本的rule配置

    Object.keys(def).forEach(k => {
        // 如果最基本的配置项不存在rule中，则进行添加
        if (!hasProperty(rule, k)) rule[k] = def[k];
    });
    return rule;
}

// 拿到rule.control
function getCtrl(ctx) {
    const control = ctx.rule.control || [];
    if (is.Object(control)) return [control]; //如果是对象，转为数组
    else return control;
}

function findCtrl(ctx, rule) {
    for (let i = 0; i < ctx.ctrlRule.length; i++) {
        const ctrl = ctx.ctrlRule[i];
        if (ctrl.children === rule)
            return ctrl;
    }
}

function isCtrl(ctx) {
    return !!ctx.rule.__ctrl;
}
