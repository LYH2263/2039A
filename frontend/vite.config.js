import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        post: resolve(__dirname, 'post.html'),
        create_post: resolve(__dirname, 'create_post.html'),
        login: resolve(__dirname, 'admin/login.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        admin_posts: resolve(__dirname, 'admin/posts.html'),
        admin_comments: resolve(__dirname, 'admin/comments.html'),
        admin_edit: resolve(__dirname, 'admin/edit_post.html'),
      }
    }
  }
})
