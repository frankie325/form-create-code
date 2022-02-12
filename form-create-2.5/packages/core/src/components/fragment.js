const NAME = 'fcFragment';

// 函数式组件
export default {
    name: NAME,
    functional: true,
    props: ['vnode'],
    render(h, ctx) {
        // 直接使用props传递的vnode，不存在则使用children
        return ctx.props.vnode ? ctx.props.vnode : ctx.children
    }
}
