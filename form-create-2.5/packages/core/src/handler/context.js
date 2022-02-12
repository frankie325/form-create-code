import extend from '@form-create/utils/lib/extend';
import toCase from '@form-create/utils/lib/tocase';
import BaseParser from '../factory/parser';
import {$del} from '@form-create/utils/lib/modify';
import is from '@form-create/utils/lib/type';
import {invoke} from '../frame/util';


export default function useContext(Handler) {
    extend(Handler.prototype, {
        getCtx(id) {
            return this.getFieldCtx(id) || this.getNameCtx(id)[0] || this.ctxs[id];
        },
        getCtxs(id) {
            return this.fieldCtx[id] || this.nameCtx[id] || (this.ctxs[id] ? [this.ctxs[id]] : []);
        },
        setIdCtx(ctx, key, type) {
            /*
                往handler实例添加如下字段
                handler.fieldCtx = {
                    field字段:[ ctx实例 ]
                }
            */ 
            const field = `${type}Ctx`;
            if (!this[field][key]) {
                this[field][key] = [ctx];
            } else {
                this[field][key].push(ctx);
            }
        },
        rmIdCtx(ctx, key, type) {
            const field = `${type}Ctx`;
            const lst = this[field][key];
            if (!lst) return false;
            const flag = lst.splice(lst.indexOf(ctx) >>> 0, 1).length > 0;
            if (!lst.length) {
                delete this[field][key];
            }
            return flag;
        },
        getFieldCtx(field) {
            return (this.fieldCtx[field] || [])[0];
        },
        getNameCtx(name) {
            return this.nameCtx[name] || [];
        },
        /*
        将RuleContext实例设置到handler.ctxs
        ctxs = {
            id:RuleContext实例
        }
        */ 
        setCtx(ctx) {
            let {id, field, name, rule} = ctx; 
            this.ctxs[id] = ctx;
            name && this.setIdCtx(ctx, name, 'name'); //rule.name才会设置
            if (!ctx.input) return; //rule.field不存在直接返回
            this.setIdCtx(ctx, field, 'field'); //添加handler.fieldCtx字段
            this.setFormData(ctx, ctx.parser.toFormValue(rule.value, ctx));//设置value到handler.formData
            if (this.isMounted && !this.reloading) {
                this.vm.$emit('change', ctx.field, rule.value, ctx.origin, this.api);
            }
        },
        getParser(ctx) {
            // 拿到FormCreate实例.parsers
            const list = this.fc.parsers;
            // 拿到rule.type对应的parser
            return list[ctx.originType] || list[toCase(ctx.type)] || list[ctx.trueType] || BaseParser;
        },
        // 设置parser对象到RuleContext实例
        bindParser(ctx) {
            ctx.setParser(this.getParser(ctx));
        },
        // 拿到CreateNode.aliasMap中对应的表单控件名称，比如参数为"button"，则返回iButton
        getType(alias) {
            const map = this.fc.CreateNode.aliasMap;
            const type = map[alias] || map[toCase(alias)] || alias;
            return toCase(type); //转为驼峰
        },
        noWatch(fn) {
            if (!this.noWatchFn) {
                this.noWatchFn = fn;
            }
            invoke(fn);
            if (this.noWatchFn === fn) {
                this.noWatchFn = null;
            }
        },
        // 监听ctx.rule中的属性
        watchCtx(ctx) {
            const vm = this.vm;
            const none = ['field', 'value', 'vm', 'template', 'name', 'config', 'control', 'inject', 'sync', 'payload', 'optionsTo', 'update'];
            // 遍历rule中的属性，进行监听，none中列出的属性不用监听
            Object.keys(ctx.rule).filter(k => k[0] !== '_' && none.indexOf(k) === -1).forEach((key) => {
                const flag = key === 'children'; //遍历到rule.children为true
                ctx.watch.push(vm.$watch(() => ctx.rule[key], (n, o) => {
                    if (this.loading || this.noWatchFn || this.reloading) return;

                    if (flag && ctx.parser.loadChildren === false) {
                        this.$render.clearCache(ctx);
                        this.nextRefresh();
                        return;
                    }
                    this.watching = true;
                    // if (key === 'hidden')
                    //     ctx.updateKey(true);
                    // else
                    if (key === 'link') { //rule.link属性改变时
                        ctx.link();
                        return;
                    } else if (['props', 'on', 'nativeOn', 'deep'].indexOf(key) > -1) {
                        this.parseInjectEvent(ctx.rule, n || {});
                        if (key === 'props' && ctx.input) {
                            this.setFormData(ctx, ctx.parser.toFormValue(ctx.rule.value, ctx));
                        }
                    } else if (['emit', 'nativeEmit'].indexOf(key) > -1)
                        this.parseEmit(ctx, key === 'emit');
                    else if (['prefix', 'suffix'].indexOf(key) > -1)
                        n && this.loadFn(n, ctx.rule);
                    else if (key === 'type') {
                        ctx.updateType();
                        this.bindParser(ctx);
                    } else if (key === 'children') {
                        const flag = is.trueArray(n);
                        this.deferSyncValue(() => {
                            if (n !== o) {
                                this.rmSub(o);
                                this.$render.initOrgChildren();
                            }
                            flag && this.loadChildren(n, ctx);
                            this.vm.$emit('update', this.api);
                        });
                    }
                    this.$render.clearCache(ctx);
                    this.watching = false;
                }, {deep: !flag, sync: flag})); //非rule.children属性，开启深度监听，异步处理，rule.children属性则相反
            });
            this.watchEffect(ctx);
        },
        rmSub(sub) {
            is.trueArray(sub) && sub.forEach(r => {
                r && r.__fc__ && this.rmCtx(r.__fc__);
            })
        },
        rmCtx(ctx) {
            if (ctx.deleted) return;
            const {id, field, input, name} = ctx;
            if (ctx.input) {
                Object.defineProperty(ctx.rule, 'value', {
                    value: ctx.rule.value,
                    writable: true
                });
            }

            $del(this.ctxs, id);
            $del(this.$render.tempList, id);
            $del(this.$render.orgChildren, id);
            $del(this.vm.ctxInject, id);
            $del(this.formData, id);
            $del(this.subForm, id);
            $del(ctx, 'cacheValue');

            input && this.rmIdCtx(ctx, field, 'field');
            name && this.rmIdCtx(ctx, name, 'name');

            this.deferSyncValue(() => {
                if (!this.reloading) {
                    if (ctx.parser.loadChildren !== false) {
                        if (is.trueArray(ctx.rule.children)) {
                            ctx.rule.children.forEach(h => h.__fc__ && this.rmCtx(h.__fc__));
                        }
                    }
                    if (ctx.root === this.rules) {
                        this.vm._renderRule();
                    }
                }
            }, input);

            const index = this.sort.indexOf(id);
            if (index > -1) {
                this.sort.splice(index, 1);
            }

            this.$render.clearCache(ctx);
            ctx.delete();
            this.effect(ctx, 'deleted');
            input && !this.fieldCtx[field] && this.vm.$emit('removeField', field, ctx.rule, this.api);
            ctx.rule.__ctrl || this.vm.$emit('removeRule', ctx.rule, this.api);
            return ctx;
        },
    })
}
