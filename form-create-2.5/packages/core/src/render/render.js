import extend from '@form-create/utils/lib/extend';
import mergeProps from '@form-create/utils/lib/mergeprops';
import is, {hasProperty} from '@form-create/utils/lib/type';
import {_vue as Vue} from '../frame';
import {tip} from '@form-create/utils/lib/console';
import {invoke, mergeRule} from '../frame/util';
import toCase, {lower} from '@form-create/utils/lib/tocase';
import {$set, deepSet, toLine} from '@form-create/utils';

export default function useRender(Render) {
    extend(Render.prototype, {
        initRender() {
            this.tempList = {};
            this.clearOrgChildren();
        },
        initOrgChildren() {
            // 拿到handle.ctxs
            const ctxs = this.$handle.ctxs;
            /*
                初始化this.orgChildren，有rule.children的都会添加到这里，这里会浅拷贝rule.children
                this.orgChildren = {
                    id:[...] 为rule.children
                }
            */
            this.orgChildren = Object.keys(ctxs).reduce((initial, id) => {
                if (ctxs[id].parser.loadChildren !== false) {
                    const children = ctxs[id].rule.children;
                    initial[id] = is.trueArray(children) ? [...children] : []; //浅拷贝
                }

                return initial;
            }, {});

        },
        clearOrgChildren() {
            this.orgChildren = {};
        },
        /*  
            支持通过插槽扩展自定义组件
            <form-create v-model="fApi" :rule="rule" :option="option" @ceshi-input="emitFun" @sync="syncFun">
                <template slot="type-field-component" slot-scope="scope">
                    <i-input :value="''+scope.model.value" @input="(v)=>scope.model.callback(parseInt(v))" />
                </template>
            </form-create>

            rule = {
                type: "fieldComponent",
                field: "fieldComponent",
                title: "自定义插槽",
                value: 100,
            },

            getTypeSlot用来得到上面的插槽函数
        */
        getTypeSlot(type) {
            const name = 'type-' + toLine(type); //转为连字符，type-input
            const _fn = (vm) => {
                if (vm) {
                    // 从form-create实例中拿到插槽函数
                    const slot = vm.$scopedSlots[name] || vm.$scopedSlots['type-' + type];
                    if (slot) {
                        return slot;
                    }
                    // 如果没找到，继续往上面的表单找（可能是嵌套表单）
                    return _fn(vm.$pfc);
                }
            }
            // 返回插槽函数
            return _fn(this.vm);
        },
        render() {
            if (!this.vm.isShow) {
                return;
            }
            this.$h = this.vm.$createElement; //拿到渲染函数
            this.$manager.beforeRender(); //设置Form组件的属性

            let vn;

            const make = () => this.renderList();
            make.renderSlot = slot => this.renderList(slot);
            make.renderName = name => this.renderId(name);
            make.renderField = field => this.renderId(field, 'field');

            if (this.vm.$scopedSlots.container) {
                vn = [this.vm.$scopedSlots.container(make)];
            } else {
                vn = make(); //执行renderList，得到VNode
            }

            // 生成Form包裹所有组件
            return this.$manager.render(vn);
        },
        renderList(slot) {
            // 遍历handler.sort
            return this.sort.map((id) => {
                return slot ? this.renderSlot(this.$handle.ctxs[id], slot) : this.renderCtx(this.$handle.ctxs[id]);
            }).filter((val) => val !== undefined);
        },
        //处理rule.vm属性的三种形式
        makeVm(rule) {
            const vm = rule.vm;
            if (!vm) //不存在，则创建Vue实例
                return new Vue;
            else if (is.Function(vm))//如果是方法
                // 该方法必须返回Vue实例，传入第一个参数
                return invoke(() => rule.vm(this.$handle.getInjectData(rule)));
            else if (!vm._isVue) //如果不是vue实例，则为对象
                return new Vue(vm);
            return vm;
        },
        // 合并option.global中的一些属性
        mergeGlobal(ctx) {
            const g = this.$handle.options.global;
            if (!g) return;
            //todo 缓存配置,更新 option 更新
            if (!ctx.cacheConfig)
                ctx.cacheConfig = g[ctx.originType] || g[ctx.type] || g[ctx.trueType] || {};
            ctx.prop = mergeRule({}, [g['*'], ctx.cacheConfig, ctx.prop]);
        },
        // 处理optionsTo属性
        setOptions(ctx) {
            if (ctx.prop.optionsTo && ctx.prop.options) {
                deepSet(ctx.prop, ctx.prop.optionsTo, ctx.prop.options);
            }
        },
        // 处理deep属性
        deepSet(ctx) {
            const deep = ctx.rule.deep;
            deep && Object.keys(deep).sort((a, b) => a.length < b.length ? -1 : 1).forEach(str => {
                deepSet(ctx.prop, str, deep[str]);
            });
        },
        // 合并rule中的数据到vm.$props，作为组件的props传递，rule.vm实例的propsData定义了的属性，才会进行合并
        setTempProps(vm, ctx) {
            if (!vm.$props) return;

            const {prop} = ctx; //拿到rule
            const keys = Object.keys(vm.$props);
            const inject = this.injectProp(ctx); //拿到注入的其他参数
            const injectKeys = Object.keys(inject);

            // 遍历$props
            keys.forEach(key => {
                if (hasProperty(prop.props, key)) //如果存在rule.props，从这里面找，进行合并
                    vm.$props[key] = prop.props[key];

                // 否则，从其他属性找
                else if (injectKeys.indexOf(key) > -1) vm.$props[key] = inject[key];
            });

            // 设置模板组件的value属性
            const key = (vm.$options.model && vm.$options.model.prop) || 'value';
            if (keys.indexOf(key) > -1) {
                vm.$props[key] = prop.value;
            }
        },
        /*
            渲染rule.type为template的rule项
            需要传递rule.template = "<div>i am template</div>"属性。
            传递rule.vm，模板组件的 Vue 示例对象，用于解析模板
            比如
            rule = {
                type: "template",
                template: "<div>i am template</div>",
                vm: new Vue({
                    propsData:{...},
                    data(){
                        return {}
                    }
                }),
                value:"",
                props:{ ... } //这里传的props将会覆盖propsData
            }
        */ 
        renderTemp(ctx) {
            if (!Vue.compile) {
                tip('当前使用的Vue构建版本不支持compile,无法使用template功能');
                return [];
            }
            const rule = ctx.prop;
            const {id, key} = ctx;

            if (!this.tempList[id]) {
                if (!ctx.el) {
                    ctx.el = this.makeVm(rule); //处理rule.vm属性的三种形式
                    this.vm.$nextTick(() => ctx.parser.mounted(ctx));
                }

                let vm = ctx.el;
                if (ctx.input) //如果定义了rule.field
                    
                    // 当该模板组件通过$emit("input",xxx)触发时，则调用onInput更新
                    vm.$on((vm.$options.model && vm.$options.model.event) || 'input', (value) => {
                        this.onInput(ctx, value);
                    });
                
                //添加到render.tempList
                this.tempList[id] = {
                    vm,
                    template: Vue.compile(rule.template) //得到渲染函数
                };
            }

            const {vm, template} = this.tempList[id];

            // 合并rule中的数据到vm.$props，作为组件的props传递
            this.setTempProps(vm, ctx);

            // 执行渲染函数，得到VNode
            const vn = template.render.call(vm);

            if (is.Undef(vn.data)) vn.data = {};
            vn.key = key;
            vn.data.ref = ctx.ref; //设置ref
            vn.data.key = key; //设置key
            return vn;
        },
        // 处理rule.prefix和处理rule.suffix配置
        parseSide(side) {
            // 如果是对象，则又是一个rule配置项
            return is.Object(side) ? mergeRule({}, side) : side;
        },
        // 生成prefix，suffix的VNode
        renderSides(vn, ctx, temp) {
            const prop = ctx[temp ? 'rule' : 'prop'];
            return [this.renderRule(this.parseSide(prop.prefix)), vn, this.renderRule(this.parseSide(prop.suffix))];
        },
        renderSlot(ctx, slot) {
            return ctx.rule.slot === slot ? this.renderCtx(ctx) : undefined;
        },
        renderId(name, type) {
            const ctxs = this.$handle[type === 'field' ? 'fieldCtx' : 'nameCtx'][name]
            return ctxs ? ctxs.map(ctx => this.renderCtx(ctx, ctx.parent)) : undefined;
        },
        renderCtx(ctx, parent) {
            if (ctx.type === 'hidden') return; //rule.type为hidden，直接返回
            const rule = ctx.rule;
            const preview = this.options.preview || false;

            if ((!this.cache[ctx.id]) || this.cache[ctx.id].slot !== rule.slot) {
                let vn; 
                let cacheFlag = true; //是否需要缓存
                const _type = ctx.trueType;
                const none = !(is.Undef(rule.display) || !!rule.display); //rule.display为false，none则为true

                if (_type === 'template' && !rule.template) {
                    // rule.type为template，但是没有rule.template，直接生成rule.children的VNode
                    vn = this.renderSides(this.renderChildren(ctx), ctx, true);
                    if (none) {
                        this.display(vn);
                    }
                    vn = this.item(ctx, vn);
                } else if (_type === 'fcFragment') { //如果是fcFragment组件
                    vn = this.renderChildren(ctx);
                } else {
                    ctx.initProp(); //合并rule中的一些属性；比如重新注入参数后的事件
                    this.mergeGlobal(ctx); //合并option.global中的一些属性
                    this.$manager.tidyRule(ctx); //整理rule中的一些属性
                    this.deepSet(ctx); // 处理deep属性
                    this.setOptions(ctx);// 处理optionsTo属性
                    this.ctxProp(ctx); //进一步处理ctx.prop，主要是进行了双向数据绑定
                    let prop = ctx.prop;

                    // 添加ctx到ctx.prop.formCreateInject属性
                    prop.props.formCreateInject = this.injectProp(ctx);

                    // 
                    if (prop.hidden) {
                        this.setCache(ctx, undefined, parent);
                        return;
                    }

                    if (_type === 'template' && prop.template) {
                        // 处理rule.type为template的规则，得到VNode
                        vn = this.renderTemp(ctx);
                        cacheFlag = false;
                    } else {
                        let children = [];
                        if (ctx.parser.renderChildren) { //如果存在parser.renderChildren方法，源码没有，不过parser可以自定义
                            children = ctx.parser.renderChildren(ctx);
                        } else if (ctx.parser.loadChildren !== false) {
                            children = this.renderChildren(ctx);  //渲染子节点
                        }
                        const slot = this.getTypeSlot(ctx.type); //得到插槽函数
                        if (slot) { 
                            //如果存在插槽函数，执行得到VNode
                            vn = slot({
                                rule,
                                prop,
                                preview,
                                children, //子VNode节点
                                api: this.$handle.api,
                                model: prop.model || {} 
                            });
                        } else {
                            // 默认使用render.defaultRender生成VNode，还有一些组件在parser文件中定义了自己生成VNode的方法 
                            vn = preview ? ctx.parser.preview(children, ctx) : ctx.parser.render(children, ctx);
                        }
                    }

                    vn = this.renderSides(vn, ctx); //生成prefix，suffix的VNode

                    // rule.native为true，则生成FormItem
                    if ((!(!ctx.input && is.Undef(prop.native))) && prop.native !== true) {
                        vn = this.$manager.makeWrap(ctx, vn); //创建FormItem、Col来包裹表单控件
                    }
                    if (none) {
                        // rule.display为false时调用
                        vn = this.display(vn); // 为VNode的style添加display: 'none'属性
                    }

                    vn = this.item(ctx, vn) //包裹fragment组件
                }
                if (cacheFlag) {
                    // 设置缓存
                    this.setCache(ctx, vn, parent);
                }
                return vn;
            }

            return this.getCache(ctx);
        },
        display(vn) {
            // 如果是数组，则遍历所有VNode，设置display: 'none'属性
            if (Array.isArray(vn)) {
                const data = [];
                vn.forEach(v => {
                    if (Array.isArray(v)) return this.display(v);
                    if (this.none(v)) data.push(v);
                })
                return data;
            } else {
                return this.none(vn);
            }
        },
        // 为VNode的style添加display: 'none'属性
        none(vn) {
            if (vn && vn.data) {
                if (Array.isArray(vn.data.style)) {
                    vn.data.style.push({display: 'none'});
                } else {
                    vn.data.style = [vn.data.style, {display: 'none'}];
                }
                return vn;
            }
        },
        item(ctx, vn) {
            return this.$h('fcFragment', {
                slot: ctx.rule.slot, //设置slot，作为children中的rule，设置了rule.slot属性，则会作为父节点的插槽内容
                key: ctx.key,
            }, [vn]);
        },
        // 将ctx实例注入到form-create实例的ctxInject属性上
        injectProp(ctx) {
            if (!this.vm.ctxInject[ctx.id]) {
                $set(this.vm.ctxInject, ctx.id, {
                    api: this.$handle.api,
                    form: this.fc.create,
                    subForm: subForm => {
                        this.$handle.addSubForm(ctx, subForm);
                    },
                    options: [],
                    children: [],
                    prop: {},
                    preview: false,
                    field: ctx.field,
                    rule: ctx.rule,
                });
            }
            const inject = this.vm.ctxInject[ctx.id];
            extend(inject, {
                preview: this.options.preview || false,
                options: ctx.prop.options,
                children: ctx.rule.children,
                prop: (function () {
                    const temp = {...ctx.prop}; //浅拷贝ctx.prop
                    temp.on = temp.on ? {...temp.on} : {}; //浅拷贝ctx.prop.on
                    delete temp.model;
                    return temp;
                }()),
            });
            return inject;
        },
        //进一步处理ctx.prop，主要是进行了双向数据绑定
        ctxProp(ctx, custom) { //没有用到custom
            const {ref, key, rule} = ctx;
            this.$manager.mergeProp(ctx, custom);
            ctx.parser.mergeProp(ctx, custom);

            const props = [
                {
                    ref: ref,
                    key: rule.key || `${key}fc`,
                    slot: undefined,
                    on: {
                        'hook:mounted': () => {
                            this.onMounted(ctx);
                        },
                        'fc.sub-form': (subForm) => {
                            this.$handle.addSubForm(ctx, subForm);
                        }
                    },
                }
            ]

            if (!custom && ctx.input) {
                // 为表单控件进行双向绑定处理
                props.push({
                    model: {
                        value: this.$handle.getFormData(ctx),
                        callback: (value) => {
                            this.onInput(ctx, value);
                        },
                        expression: `formData.${ctx.id}`
                    },
                })
            }
            mergeProps(props, ctx.prop);
            return ctx.prop;
        },
        onMounted(ctx) {
            ctx.el = this.vm.$refs[ctx.ref];
            if (ctx.el) {
                (ctx.el.$el || ctx.el).__rule__ = ctx.rule;
            }
            ctx.parser.mounted(ctx);
            this.$handle.effect(ctx, 'mounted');
        },
        onInput(ctx, value) {
            this.$handle.onInput(ctx, value);
        },
        renderChildren(ctx) {
            // 拿到rule.children，拿到orgChildren，rule.children的浅拷贝
            const {children} = ctx.rule, orgChildren = this.orgChildren[ctx.id];

            const isRm = child => {
                // 非字符且有属性__fc__且不存在于handle.ctxs，则需要删除
                return !is.String(child) && child.__fc__ && !this.$handle.ctxs[child.__fc__.id];
            }

            // 
            if (!is.trueArray(children) && orgChildren) {
                this.$handle.deferSyncValue(() => {

                    // 遍历orgChildren
                    orgChildren.forEach(child => {
                        if (!child) return;

                        if (isRm(child)) {
                            this.$handle.rmCtx(child.__fc__);
                        }
                    });
                });
                this.orgChildren[ctx.id] = [];
                return [];
            }

            orgChildren && this.$handle.deferSyncValue(() => {
                orgChildren.forEach(child => {
                    if (!child) return;
                    if (children.indexOf(child) === -1 && isRm(child)) {
                        this.$handle.rmCtx(child.__fc__);
                    }
                });
            });

            // 返回VNode树节点
            return children.map(child => {
                if (!child) return; //无效的，直接返回
                if (is.String(child)) return child; //child可以是字符，返回该字符
                if (child.__fc__) { //如果存在__fc__，说明是有效的rule项
                    return this.renderCtx(child.__fc__, ctx); //递归调用
                }
                if (child.type) {
                    this.vm.$nextTick(() => {
                        this.$handle.loadChildren(children, ctx);
                        this.$handle.refresh();
                    });
                }
            });

        },
        // 根据rule.type在CreateNode实例中找到对应的方法生成VNode
        defaultRender(ctx, children) {
            const prop = ctx.prop;
            if (this.vNode[ctx.type])
                return this.vNode[ctx.type](prop, children);
            if (this.vNode[ctx.originType])
                return this.vNode[ctx.originType](prop, children);
            return this.vNode.make(lower(ctx.originType), prop, children);
        },
        // 用来生成非rule规则项的VNode，比如Form、FormItem、Row、Col等
        renderRule(rule, children, origin) {
            if (!rule) return undefined;
            if (is.String(rule)) return rule; //是字符则直接返回

            let type;
            if (origin) {
                type = rule.type;
            } else {
                type = rule.is;
                if (rule.type) {
                    type = toCase(rule.type);
                    const alias = this.vNode.aliasMap[type]; //根据type得到组件名称
                    if (alias) type = toCase(alias);
                }
            }

            if (!type) return undefined;
            let data = [[children]];
            
            if (is.trueArray(rule.children)) {
                // 递归处理rule.children
                data.push(rule.children.map(v => this.renderRule(v)));
            }
            // 返回VNode
            return this.$h(type, {...rule}, data);
        }
    })
}
