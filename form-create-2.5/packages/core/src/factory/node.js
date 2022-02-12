import toLine from '@form-create/utils/lib/toline';
import is from '@form-create/utils/lib/type';
import toString from '@form-create/utils/lib/tostring';
import extend from '@form-create/utils/lib/extend';
import Vue from 'vue';

function parseProp(prop) {
    if (is.String(prop))
        return {domProps: {innerHTML: prop}};
    return prop;
}

export function CreateNodeFactory() {

    const aliasMap = {};

    function CreateNode(vm) {
        vm && this.setVm(vm);
    }

    extend(CreateNode.prototype, {
        setVm(vm) {
            this.vm = vm;
            this.$h = vm.$createElement;
        },
        // 生成VNode
        make(tag, data, children) {
            if (Vue.config.isReservedTag(tag) && data.nativeOn) delete data.nativeOn;
            let Node = this.$h(tag, parseProp(data), children || []);
            Node.context = this.vm;
            return Node;
        },
        aliasMap
    });

    extend(CreateNode, {
        aliasMap,
        alias(alias, name) {
            /*  
                以colorPicker为例
                {
                   colorPicker: "ColorPicker",
                   color-picker: "ColorPicker",
                   colorpicker: "ColorPicker",
                }
            */ 
            aliasMap[alias] = name;
        },
        use(nodes) {
            /*
                nodes为
                {
                    button: 'iButton',
                    icon: 'Icon',
                    slider: 'Slider',
                    colorPicker: 'ColorPicker',
                    ....
                }
            */
            Object.keys(nodes).forEach((k) => {
                const line = toLine(k); //驼峰转为连字符
                const lower = toString(k).toLocaleLowerCase(); //仅转换为小写
                const v = nodes[k];
                // 将原本、连字符形式、小写形式
                [k, line, lower].forEach(n => {
                    CreateNode.alias(k, v); //添加到aliasMap
                    //添加生成VNode的原型方法
                    CreateNode.prototype[n] = function (data, children) {
                        return this.make(v, data, children);
                    };
                });
            });
        }
    })

    return CreateNode;
}
