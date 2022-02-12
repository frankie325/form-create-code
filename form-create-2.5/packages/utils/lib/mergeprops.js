export const normalMerge = ['attrs', 'props', 'domProps', 'scopedSlots'];
export const toArrayMerge = ['class', 'style', 'directives'];
export const functionalMerge = ['on', 'nativeOn'];

/**
 * @description: mergeProps用来合并rule中的一系列属性
 * @param {*} objects 要合并的rule，用数组包裹了
 * @param {*} initial 目标对象
 * @param {*} opt 
 * @return {*}
 */
const mergeProps = (objects, initial = {}, opt = {}) => {
    //['attrs', 'props', 'domProps', 'scopedSlots', 'effect', 'deep']
    const _normalMerge = [...normalMerge, ...opt['normal'] || []];
    // ['class', 'style', 'directives', 'validate', 'children', 'control']
    const _toArrayMerge = [...toArrayMerge, ...opt['array'] || []];
    // ['on', 'nativeOn']
    const _functionalMerge = [...functionalMerge, ...opt['functional'] || []];
    const propsMerge = opt['props'] || [];
    /*
    遍历rule，a为initial，为目标对象，以下面为例
    rule = {
        // _normalMerge中的属性
        attrs: {
            name: "kfg"
        },
        // _toArrayMerge中的属性
        validate:[ {}, {} ],
        // _functionalMerge中的属性
        on:{
            change:[()=>{},()=>{ }],
        }
    }
    
    */ 
    return objects.reduce((a, b) => {
        for (const key in b) {
            if (a[key]) {
                if (propsMerge.indexOf(key) > -1) {
                    a[key] = mergeProps([b[key]], a[key]);
                } else if (_normalMerge.indexOf(key) > -1) {
                    a[key] = {...a[key], ...b[key]} // 作为_normalMerge中的属性，直接合并
                } else if (_toArrayMerge.indexOf(key) > -1) {
                    // 作为_toArrayMerge中的属性，判断是否为数组，不是则转为数组，进行合并
                    const arrA = a[key] instanceof Array ? a[key] : [a[key]];
                    const arrB = b[key] instanceof Array ? b[key] : [b[key]];
                    a[key] = [...arrA, ...arrB]
                } else if (_functionalMerge.indexOf(key) > -1) {
                    // 作为_functionalMerge中的属性
                    for (const event in b[key]) { //遍历rule.on
                        if (a[key][event]) { 
                            //如果在目标对象a中，存在对应事件方法，判断是否为数组，不是则转为数组
                            const arrA = a[key][event] instanceof Array ? a[key][event] : [a[key][event]];
                            // 将要合并的事件方法转为数组
                            const arrB = b[key][event] instanceof Array ? b[key][event] : [b[key][event]];
                            a[key][event] = [...arrA, ...arrB]
                        } else {
                            // 如果不存在，则直接赋值
                            a[key][event] = b[key][event]
                        }
                    }
                } else if (key === 'hook') {
                    for (let hook in b[key]) {
                        if (a[key][hook]) {
                            a[key][hook] = mergeFn(a[key][hook], b[key][hook])
                        } else {
                            a[key][hook] = b[key][hook]
                        }
                    }
                } else {
                    a[key] = b[key]
                }
            } else {
                // 如果在目标对象a中不存在该属性

                if (_normalMerge.indexOf(key) > -1 || _functionalMerge.indexOf(key) > -1 || propsMerge.indexOf(key) > -1) {
                    a[key] = {...b[key]}
                } else if (_toArrayMerge.indexOf(key) > -1) {
                    a[key] = b[key] instanceof Array ? [...b[key]] : (typeof b[key] === 'object' ? {...b[key]} : b[key]);
                } else
                    a[key] = b[key];
            }
        }
        return a
    }, initial);
}

const mergeFn = (fn1, fn2) =>
    function () {
        fn1 && fn1.apply(this, arguments);
        fn2 && fn2.apply(this, arguments);
    };

export default mergeProps;
