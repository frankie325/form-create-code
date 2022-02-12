import extend from '@form-create/utils/lib/extend';
import {$set} from '@form-create/utils/lib/modify';
import is, {hasProperty} from '@form-create/utils/lib/type';
import {invoke} from '../frame/util';
import toArray from '@form-create/utils/lib/toarray';

export default function useInput(Handler) {
    extend(Handler.prototype, {
        getValue(ctx) {
            if (is.Undef(ctx.cacheValue)) {
                // 如果没有定义ctx.cacheValue，则设置cacheValue
                ctx.cacheValue = ctx.parser.toValue(this.getFormData(ctx), ctx);
            }
            return ctx.cacheValue;
        },
        // 重新设置value到handler.formData
        setValue(ctx, value, formValue, setFlag) {
            if (ctx.deleted) return;
            ctx.cacheValue = value; //更新cacheValue
            this.changeStatus = true;
            this.nextRefresh();
            this.$render.clearCache(ctx);
            this.setFormData(ctx, formValue); //重新设置handler.formData
            this.syncValue();
            this.valueChange(ctx, value);
            this.vm.$emit('change', ctx.field, value, ctx.origin, this.api, setFlag);
            this.effect(ctx, 'value');
        },
        onInput(ctx, value) {
            let val;
            if (ctx.input && (this.isQuote(ctx, val = ctx.parser.toValue(value, ctx)) || this.isChange(ctx, val))) {
                this.setValue(ctx, val, value); //更新value
            }
        },
        // 设置value到handler.formData
        setFormData(ctx, value) {
            $set(this.formData, ctx.id, value);
        },
        getFormData(ctx) {
            return this.formData[ctx.id];
        },
        validate() {
            toEmpty(this.vm.validate);
            this.fields().forEach(id => {
                this.fieldCtx[id].forEach(ctx => {
                    this.vm.validate[ctx.id] = toArray(ctx.rule.validate);
                });
            });
            return this.vm.validate;
        },
        syncForm() {
            toEmpty(this.form);
            Object.defineProperties(this.form, this.fields().reduce((initial, field) => {
                const ctx = this.getFieldCtx(field);
                const handle = this.valueHandle(ctx);
                handle.configurable = true;
                initial[field] = handle;
                return initial;
            }, Object.keys(this.appendData).reduce((initial, field) => {
                initial[field] = {
                    enumerable: true,
                    configurable: true,
                    get: () => {
                        return this.appendData[field];
                    },
                    set: (val) => {
                        this.appendData[field] = val;
                    }
                }
                return initial;
            }, {})));
            this.syncValue();
        },
        // 对value进行拦截
        valueHandle(ctx) {
            return {
                enumerable: true,
                get: () => {
                    // 访问时返回ctx.cacheValue
                    return this.getValue(ctx);
                },
                set: (value) => {
                    if (this.isChange(ctx, value)) {
                        // 如果值改变了，则重新设置
                        this.setValue(ctx, value, ctx.parser.toFormValue(value, ctx), true);
                    }
                }
            };
        },
        // 
        appendValue(rule) {
            // 不存在rule.field或者不存在appendData[field]，则返回
            if (!rule.field || !hasProperty(this.appendData, rule.field)) return;
            rule.value = this.appendData[rule.field];
            delete this.appendData[rule.field];
        },
        addSubForm(ctx, subForm) {
            if (ctx.input) {
                this.subForm[ctx.id] = subForm;
            }
        },
        deferSyncValue(fn, sync) {
            if (!this.deferSyncFn) {
                this.deferSyncFn = fn; //注册该方法
            }
            if (!this.deferSyncFn.sync) {
                this.deferSyncFn.sync = sync;
            }
            invoke(fn); // 错误拦截，并执行fn
            if (this.deferSyncFn === fn) {
                this.deferSyncFn = null;
                if (fn.sync) {
                    this.syncValue();
                }
            }
        },
        syncValue() {
            if (this.deferSyncFn) {
                return this.deferSyncFn.sync = true;
            }
            this.vm._updateValue({...this.form});
        },
        isChange(ctx, value) {
            return JSON.stringify(ctx.rule.value, strFn) !== JSON.stringify(value, strFn);
        },
        // 判断value是不是引用类型，且与之前的value相等
        isQuote(ctx, value) {
            return (is.Object(value) || Array.isArray(value)) && value === ctx.rule.value;
        },
        refreshUpdate(ctx, val) {
            if (is.Function(ctx.rule.update)) {
                const state = invoke(() => ctx.rule.update(val, ctx.origin, this.api));
                if (state === undefined) return;
                ctx.rule.hidden = state === true;
            }
        },
        valueChange(ctx, val) {
            this.refreshRule(ctx, val);
            this.bus.$emit('change-' + ctx.field, val);
        },
        refreshRule(ctx, val) {
            if (this.refreshControl(ctx)) {
                this.$render.clearCacheAll();
                this.loadRule();
                this.vm.$emit('update', this.api);
                this.refresh();
            }
            this.refreshUpdate(ctx, val);
        },
        appendLink(ctx) {
            // 拿到rule.link，应该为数组
            const link = ctx.rule.link;
            is.trueArray(link) && link.forEach(field => {
                const fn = () => this.refreshRule(ctx, ctx.rule.value);

                this.bus.$on('change-' + field, fn); //中央事件总线添加该方法，进行更新

                // 添加移除方法到ctx.linkOn，移除更新事件
                ctx.linkOn.push(() => this.bus.$off('change-' + field, fn));
            });
        },
        fields() {
            return Object.keys(this.fieldCtx);
        },
    });
}


function strFn(key, val) {
    return typeof val === 'function' ? '' + val : val;
}

function toEmpty(obj) {
    Object.keys(obj).forEach(k => delete obj[k]);
}
