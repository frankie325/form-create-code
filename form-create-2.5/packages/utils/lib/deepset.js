
/**
 * @description: 以optionsTo为例
 * rule = {
 *      props: {
 *          data:[]
 *      },
 *      optionsTo:"props.data",
 *      options:[...]
 * }
 * @param {*} data 为rule规则
 * @param {*} idx 为optionsTo值
 * @param {*} val options数组值
 * @return {*}
 */
export default function deepSet(data, idx, val) {
    let _data = data, to;
    // 以.分割遍历optionsTo值
    (idx || '').split('.').forEach(v => {
        // 第二次循环进入该判断
        if (to) {
            if (!_data[to] || typeof _data[to] != 'object') {
                // 如果没值，则赋值为对象
                _data[to] = {} 
            }
            // _data = rule.props
            _data = _data[to];
        }
        // 第一次循环，to为props
        to = v;
    })
    // 遍历完后_data = rule.props.data
    // 将options数组值添加到props.data
    _data[to] = val;
    return _data;
}
